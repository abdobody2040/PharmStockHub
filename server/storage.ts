import { users, categories, specialties, stockItems, stockAllocations, stockMovements } from "@shared/schema";
import type { 
  User, InsertUser, 
  Category, InsertCategory,
  Specialty, InsertSpecialty,
  StockItem, InsertStockItem,
  StockAllocation, InsertStockAllocation,
  StockMovement, InsertStockMovement,
  RoleType
} from "@shared/schema";
import { ROLE_PERMISSIONS } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPg from "connect-pg-simple";
import { db, pool } from "./db";
import { eq, lte, and, isNotNull } from "drizzle-orm";
import { addDays } from "date-fns";

const MemoryStore = createMemoryStore(session);
const PostgresSessionStore = connectPg(session);

// Interface for storage operations
export interface IStorage {
  // Specialty operations
  getSpecialties(): Promise<Specialty[]>;
  getSpecialty(id: number): Promise<Specialty | undefined>;
  createSpecialty(specialty: InsertSpecialty): Promise<Specialty>;
  updateSpecialty(id: number, specialty: Partial<Specialty>): Promise<Specialty | undefined>;
  deleteSpecialty(id: number): Promise<boolean>;
  
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  getUsersByRole(role: RoleType): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;

  // Category operations
  getCategories(): Promise<Category[]>;
  getCategory(id: number): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, category: Partial<Category>): Promise<Category | undefined>;
  deleteCategory(id: number): Promise<boolean>;
  getStockItemsByCategory(categoryId: number): Promise<StockItem[]>;

  // Stock item operations
  getStockItems(): Promise<StockItem[]>;
  getStockItem(id: number): Promise<StockItem | undefined>;
  createStockItem(item: InsertStockItem): Promise<StockItem>;
  updateStockItem(id: number, item: Partial<StockItem>): Promise<StockItem | undefined>;
  deleteStockItem(id: number): Promise<boolean>;
  getExpiringItems(daysThreshold: number): Promise<StockItem[]>;

  // Stock allocation operations
  getAllocations(userId?: number): Promise<StockAllocation[]>;
  createAllocation(allocation: InsertStockAllocation): Promise<StockAllocation>;
  updateAllocation(id: number, allocation: Partial<StockAllocation>): Promise<StockAllocation | undefined>;
  deleteAllocation(id: number): Promise<boolean>;

  // Stock movement operations
  getMovements(): Promise<StockMovement[]>;
  createMovement(movement: InsertStockMovement): Promise<StockMovement>;

  // Permission check
  hasPermission(userId: number, permission: keyof typeof ROLE_PERMISSIONS.ceo): Promise<boolean>;

  // Session store
  sessionStore: session.Store;
}

// In-memory implementation for development
export class MemStorage implements IStorage {
  private usersMap: Map<number, User>;
  private categoriesMap: Map<number, Category>;
  private specialtiesMap: Map<number, Specialty>;
  private stockItemsMap: Map<number, StockItem>;
  private stockAllocationsMap: Map<number, StockAllocation>;
  private stockMovementsMap: Map<number, StockMovement>;

  private userIdCounter: number;
  private categoryIdCounter: number;
  private specialtyIdCounter: number;
  private stockItemIdCounter: number;
  private stockAllocationIdCounter: number;
  private stockMovementIdCounter: number;

  sessionStore: session.Store;

  constructor() {
    this.usersMap = new Map();
    this.categoriesMap = new Map();
    this.specialtiesMap = new Map();
    this.stockItemsMap = new Map();
    this.stockAllocationsMap = new Map();
    this.stockMovementsMap = new Map();

    this.userIdCounter = 1;
    this.categoryIdCounter = 1;
    this.specialtyIdCounter = 1;
    this.stockItemIdCounter = 1;
    this.stockAllocationIdCounter = 1;
    this.stockMovementIdCounter = 1;

    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // Clear expired sessions every day
    }) as session.Store; // Explicitly cast to session.Store

    // Initialize with default categories
    this.initializeData();
  }

  // Initialize with some default data
  private async initializeData() {
    // Add default categories
    const defaultCategories = [
      { name: 'Brochures', color: 'bg-blue-500' },
      { name: 'Samples', color: 'bg-green-500' },
      { name: 'Gifts', color: 'bg-purple-500' },
      { name: 'Banners', color: 'bg-yellow-500' },
      { name: 'Digital Media', color: 'bg-indigo-500' },
      { name: 'Other', color: 'bg-gray-500' }
    ];

    for (const category of defaultCategories) {
      await this.createCategory(category);
    }

    // Add default specialties
    const defaultSpecialties = [
      { name: 'CNS', description: 'Central Nervous System' },
      { name: 'Primary Care 1', description: 'Primary Care Group 1' },
      { name: 'Primary Care 2', description: 'Primary Care Group 2' },
      { name: 'GIT', description: 'Gastrointestinal Tract' },
      { name: 'Specialty', description: 'Specialty Products' },
      { name: 'OTC', description: 'Over The Counter' }
    ];

    for (const specialty of defaultSpecialties) {
      await this.createSpecialty(specialty);
    }
  }

  // Specialty operations
  async getSpecialties(): Promise<Specialty[]> {
    return Array.from(this.specialtiesMap.values());
  }

  async getSpecialty(id: number): Promise<Specialty | undefined> {
    return this.specialtiesMap.get(id);
  }

  async createSpecialty(specialty: InsertSpecialty): Promise<Specialty> {
    const id = this.specialtyIdCounter++;
    const timestamp = new Date();
    const newSpecialty: Specialty = {
      ...specialty,
      id,
      createdAt: timestamp,
      description: specialty.description === undefined ? null : specialty.description,
    };
    this.specialtiesMap.set(id, newSpecialty);
    return newSpecialty;
  }

  async updateSpecialty(id: number, specialtyData: Partial<Specialty>): Promise<Specialty | undefined> {
    const specialty = this.specialtiesMap.get(id);
    if (!specialty) return undefined;

    const updatedSpecialty = { ...specialty, ...specialtyData };
    this.specialtiesMap.set(id, updatedSpecialty);
    return updatedSpecialty;
  }

  async deleteSpecialty(id: number): Promise<boolean> {
    return this.specialtiesMap.delete(id);
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.usersMap.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    for (const user of Array.from(this.usersMap.values())) {
      if (user.username === username) {
        return user;
      }
    }
    return undefined;
  }

  async getUsers(): Promise<User[]> {
    return Array.from(this.usersMap.values());
  }

  async getUsersByRole(role: RoleType): Promise<User[]> {
    return Array.from(this.usersMap.values()).filter(user => user.role === role);
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const timestamp = new Date();
    const newUser: User = {
      ...user,
      id,
      createdAt: timestamp,
      region: user.region === undefined ? null : user.region,
      avatar: user.avatar === undefined ? null : user.avatar,
      specialtyId: user.specialtyId === undefined ? null : user.specialtyId,
    };
    this.usersMap.set(id, newUser);
    return newUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.usersMap.delete(id);
  }

  // Category operations
  async getCategories(): Promise<Category[]> {
    return Array.from(this.categoriesMap.values());
  }

  async getCategory(id: number): Promise<Category | undefined> {
    return this.categoriesMap.get(id);
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const id = this.categoryIdCounter++;
    const newCategory: Category = { ...category, id };
    this.categoriesMap.set(id, newCategory);
    return newCategory;
  }

  async updateCategory(id: number, categoryData: Partial<Category>): Promise<Category | undefined> {
    const category = this.categoriesMap.get(id);
    if (!category) return undefined;

    const updatedCategory = { ...category, ...categoryData };
    this.categoriesMap.set(id, updatedCategory);
    return updatedCategory;
  }

  async deleteCategory(id: number): Promise<boolean> {
    return this.categoriesMap.delete(id);
  }

  async getStockItemsByCategory(categoryId: number): Promise<StockItem[]> {
    return Array.from(this.stockItemsMap.values())
      .filter(item => item.categoryId === categoryId);
  }

  // Stock item operations
  async getStockItems(): Promise<StockItem[]> {
    return Array.from(this.stockItemsMap.values());
  }

  async getStockItem(id: number): Promise<StockItem | undefined> {
    return this.stockItemsMap.get(id);
  }

  async createStockItem(item: InsertStockItem): Promise<StockItem> {
    const id = this.stockItemIdCounter++;
    const timestamp = new Date();
    const newItem: StockItem = {
      ...item,
      id,
      createdAt: timestamp,
      specialtyId: item.specialtyId === undefined ? null : item.specialtyId,
      price: item.price === undefined ? null : item.price,
      expiry: item.expiry === undefined ? null : item.expiry,
      uniqueNumber: item.uniqueNumber === undefined ? null : item.uniqueNumber,
      imageUrl: item.imageUrl === undefined ? null : item.imageUrl,
      notes: item.notes === undefined ? null : item.notes,
    };
    this.stockItemsMap.set(id, newItem);
    return newItem;
  }

  async updateStockItem(id: number, itemData: Partial<StockItem>): Promise<StockItem | undefined> {
    const item = this.stockItemsMap.get(id);
    if (!item) return undefined;

    const updatedItem = { ...item, ...itemData };
    this.stockItemsMap.set(id, updatedItem);
    return updatedItem;
  }

  async deleteStockItem(id: number): Promise<boolean> {
    return this.stockItemsMap.delete(id);
  }

  async getExpiringItems(daysThreshold: number): Promise<StockItem[]> {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

    return Array.from(this.stockItemsMap.values())
      .filter(item => item.expiry && new Date(item.expiry) <= thresholdDate);
  }

  // Stock allocation operations
  async getAllocations(userId?: number): Promise<StockAllocation[]> {
    const allAllocations = Array.from(this.stockAllocationsMap.values());
    return userId 
      ? allAllocations.filter(allocation => allocation.userId === userId)
      : allAllocations;
  }

  async createAllocation(allocation: InsertStockAllocation): Promise<StockAllocation> {
    const id = this.stockAllocationIdCounter++;
    const timestamp = new Date();
    const newAllocation: StockAllocation = { 
      ...allocation, 
      id, 
      allocatedAt: timestamp 
    };
    this.stockAllocationsMap.set(id, newAllocation);
    return newAllocation;
  }

  async updateAllocation(id: number, allocationData: Partial<StockAllocation>): Promise<StockAllocation | undefined> {
    const allocation = this.stockAllocationsMap.get(id);
    if (!allocation) return undefined;

    const updatedAllocation = { ...allocation, ...allocationData };
    this.stockAllocationsMap.set(id, updatedAllocation);
    return updatedAllocation;
  }

  async deleteAllocation(id: number): Promise<boolean> {
    return this.stockAllocationsMap.delete(id);
  }

  // Stock movement operations
  async getMovements(): Promise<StockMovement[]> {
    return Array.from(this.stockMovementsMap.values());
  }

  async createMovement(movement: InsertStockMovement): Promise<StockMovement> {
    const id = this.stockMovementIdCounter++;
    const timestamp = new Date();
    const newMovement: StockMovement = {
      ...movement,
      id,
      movedAt: timestamp,
      notes: movement.notes === undefined ? null : movement.notes,
      fromUserId: movement.fromUserId === undefined ? null : movement.fromUserId,
    };
    this.stockMovementsMap.set(id, newMovement);
    return newMovement;
  }

async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
  // Fetch existing user asynchronously
  const user = await this.getUser(id);
  if (!user) return undefined;

  // Update only provided fields in user
  Object.assign(user, userData);

  // Update the map or data storage with new user info
  this.usersMap.set(id, user);

  return user;
}

  async hasPermission(userId: number, permission: keyof typeof ROLE_PERMISSIONS.ceo): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user) return false;

    const role = user.role as RoleType;
    return ROLE_PERMISSIONS[role][permission] === true;
  }
}

// Database storage implementation
export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;
  private systemSettings: Map<string, any>;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    }) as any; // TODO: Revisit this type casting
    this.systemSettings = new Map();
    this.initializeData();
  }

  // System settings methods
  async getSystemSettings(): Promise<any> {
    return Object.fromEntries(this.systemSettings);
  }

  async updateSystemSettings(settings: any): Promise<void> {
    Object.entries(settings).forEach(([key, value]) => {
      this.systemSettings.set(key, value);
    });
  }

  // Initialize with default data if needed
  private async initializeData() {
    const existingCategories = await this.getCategories();

    // Only initialize if no categories exist
    if (existingCategories.length === 0) {
      // Add default categories
      const defaultCategories = [
        { name: 'Brochures', color: 'bg-blue-500' },
        { name: 'Samples', color: 'bg-green-500' },
        { name: 'Gifts', color: 'bg-purple-500' },
        { name: 'Banners', color: 'bg-yellow-500' },
        { name: 'Digital Media', color: 'bg-indigo-500' },
        { name: 'Other', color: 'bg-gray-500' }
      ];

      for (const category of defaultCategories) {
        await this.createCategory(category);
      }
    }

    const existingSpecialties = await this.getSpecialties();

    // Only initialize if no specialties exist
    if (existingSpecialties.length === 0) {
      // Add default specialties
      const defaultSpecialties = [
        { name: 'CNS', description: 'Central Nervous System' },
        { name: 'Primary Care 1', description: 'Primary Care Group 1' },
        { name: 'Primary Care 2', description: 'Primary Care Group 2' },
        { name: 'GIT', description: 'Gastrointestinal Tract' },
        { name: 'Specialty', description: 'Specialty Products' },
        { name: 'OTC', description: 'Over The Counter' }
      ];

      for (const specialty of defaultSpecialties) {
        await this.createSpecialty(specialty);
      }
    }
  }

  // Specialty operations
  async getSpecialties(): Promise<Specialty[]> {
    return db.select().from(specialties);
  }

  async getSpecialty(id: number): Promise<Specialty | undefined> {
    const [specialty] = await db.select().from(specialties).where(eq(specialties.id, id));
    return specialty;
  }

  async createSpecialty(specialty: InsertSpecialty): Promise<Specialty> {
    const [newSpecialty] = await db.insert(specialties).values(specialty).returning();
    return newSpecialty;
  }

  async updateSpecialty(id: number, specialtyData: Partial<Specialty>): Promise<Specialty | undefined> {
    const [updatedSpecialty] = await db
      .update(specialties)
      .set(specialtyData)
      .where(eq(specialties.id, id))
      .returning();
    return updatedSpecialty;
  }

  async deleteSpecialty(id: number): Promise<boolean> {
    const result = await db.delete(specialties).where(eq(specialties.id, id)).returning();
    return result.length > 0;
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async getUsersByRole(role: RoleType): Promise<User[]> {
    return db.select().from(users).where(eq(users.role, role));
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  // Category operations
  async getCategories(): Promise<Category[]> {
    return db.select().from(categories);
  }

  async getCategory(id: number): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }

  async updateCategory(id: number, categoryData: Partial<Category>): Promise<Category | undefined> {
    const [updatedCategory] = await db
      .update(categories)
      .set(categoryData)
      .where(eq(categories.id, id))
      .returning();
    return updatedCategory;
  }

  async deleteCategory(id: number): Promise<boolean> {
    const result = await db.delete(categories).where(eq(categories.id, id)).returning();
    return result.length > 0;
  }

  async getStockItemsByCategory(categoryId: number): Promise<StockItem[]> {
    return db.select().from(stockItems).where(eq(stockItems.categoryId, categoryId));
  }

  // Stock item operations
  async getStockItems(): Promise<StockItem[]> {
    return db.select().from(stockItems);
  }

  async getStockItem(id: number): Promise<StockItem | undefined> {
    const [item] = await db.select().from(stockItems).where(eq(stockItems.id, id));
    return item;
  }

  async createStockItem(item: InsertStockItem): Promise<StockItem> {
    // Create a clean data object to ensure proper date handling
    const cleanData: InsertStockItem = { ...item };
    
    // Handle expiry date explicitly if it exists
    if (cleanData.expiry !== undefined) {
      try {
        if (typeof cleanData.expiry === 'string') {
          // Convert string date to Date object
          cleanData.expiry = new Date(cleanData.expiry);
        }
      } catch (e) {
        console.error("Failed to parse expiry date:", e);
        // If conversion fails, we'll keep the original value
      }
    }
    
    const [newItem] = await db.insert(stockItems).values(cleanData).returning();
    return newItem;
  }

  async updateStockItem(id: number, itemData: Partial<StockItem>): Promise<StockItem | undefined> {
    // Create a clean data object to ensure proper date handling
    const cleanData: Partial<StockItem> = { ...itemData };
    
    // Handle expiry date explicitly - convert to a proper Date object if it's a string
    if (cleanData.expiry !== undefined) {
      try {
        if (typeof cleanData.expiry === 'string') {
          // Convert string date to Date object
          cleanData.expiry = new Date(cleanData.expiry);
        }
      } catch (e) {
        console.error("Failed to parse expiry date:", e);
        delete cleanData.expiry; // Remove the invalid field
      }
    }
    
    const [updatedItem] = await db
      .update(stockItems)
      .set(cleanData)
      .where(eq(stockItems.id, id))
      .returning();
    return updatedItem;
  }

  async deleteStockItem(id: number): Promise<boolean> {
    const result = await db.delete(stockItems).where(eq(stockItems.id, id)).returning();
    return result.length > 0;
  }

  async getExpiringItems(daysThreshold: number): Promise<StockItem[]> {
    const thresholdDate = addDays(new Date(), daysThreshold);

    // Get all items and filter manually
    const items = await db.select().from(stockItems);

    // Filter items that have expiry dates less than or equal to threshold date
    return items.filter(item => 
      item.expiry !== null && 
      new Date(item.expiry) <= thresholdDate
    );
  }

  // Stock allocation operations
  async getAllocations(userId?: number): Promise<StockAllocation[]> {
    if (userId) {
      return db
        .select()
        .from(stockAllocations)
        .where(eq(stockAllocations.userId, userId));
    }
    return db.select().from(stockAllocations);
  }

  async createAllocation(allocation: InsertStockAllocation): Promise<StockAllocation> {
    const [newAllocation] = await db
      .insert(stockAllocations)
      .values(allocation)
      .returning();
    return newAllocation;
  }

  async updateAllocation(id: number, allocationData: Partial<StockAllocation>): Promise<StockAllocation | undefined> {
    const [updatedAllocation] = await db
      .update(stockAllocations)
      .set(allocationData)
      .where(eq(stockAllocations.id, id))
      .returning();
    return updatedAllocation;
  }

  async deleteAllocation(id: number): Promise<boolean> {
    const result = await db
      .delete(stockAllocations)
      .where(eq(stockAllocations.id, id))
      .returning();
    return result.length > 0;
  }

  // Stock movement operations
  async getMovements(): Promise<StockMovement[]> {
    return db.select().from(stockMovements);
  }

  async createMovement(movement: InsertStockMovement): Promise<StockMovement> {
    const [newMovement] = await db
      .insert(stockMovements)
      .values(movement)
      .returning();
    return newMovement;
  }

  // Permission check
  async hasPermission(userId: number, permission: keyof typeof ROLE_PERMISSIONS.ceo): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user) return false;

    const role = user.role as RoleType;
    return ROLE_PERMISSIONS[role][permission] === true;
  }
}

// Use the database storage for production
export const storage = new DatabaseStorage();
