import express, { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from './storage';
import path from 'path';
import fs from 'fs';

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
import { setupAuth, upload } from "./auth";
import multer from "multer";
import { 
  extendedInsertStockItemSchema, 
  insertStockMovementSchema,
  insertCategorySchema
} from "@shared/schema";
import { User } from "@shared/schema";

// Add multer type extensions to Request
declare global {
  namespace Express {
    // Extend the Request interface to include file property from multer
    interface Request {
      file?: Express.Multer.File; // Type for multer file
    }
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  const { isAuthenticated, hasPermission } = setupAuth(app);

  // Static route for serving uploaded files
  const uploadDir = path.join(process.cwd(), "uploads");
  app.use('/uploads', express.static('uploads'));

  // System settings endpoints
  app.get('/api/system-settings', async (req, res) => {
    const settings = await storage.getSystemSettings();
    res.json(settings);
  });

  app.post('/api/system-settings', async (req, res) => {
    await storage.updateSystemSettings(req.body);
    res.json({ success: true });
  });

  // API routes

  // Specialties
  app.get("/api/specialties", isAuthenticated, async (req, res, next) => {
    try {
      const specialties = await storage.getSpecialties();
      res.json(specialties);
    } catch (error) {
      next(error);
    }
  });

  app.post(
    "/api/specialties", 
    isAuthenticated, 
    hasPermission("canManageSpecialties"),
    (req, res, next) => {
      if (req.user!.role !== 'ceo' && req.user!.role !== 'admin') { // Corrected
        return res.status(403).json({ message: "Only CEO and Admin can manage specialties" });
      }
      next();
    },
    async (req, res, next) => {
      try {
        const specialty = await storage.createSpecialty(req.body);
        res.status(201).json(specialty);
      } catch (error) {
        next(error);
      }
    }
  );

  app.put(
    "/api/specialties/:id", 
    isAuthenticated, 
    hasPermission("canManageSpecialties"),
    (req, res, next) => {
      if (req.user!.role !== 'ceo' && req.user!.role !== 'admin') { // Corrected
        return res.status(403).json({ message: "Only CEO and Admin can manage specialties" });
      }
      next();
    },
    async (req, res, next) => {
      try {
        const id = parseInt(req.params.id);
        const updatedSpecialty = await storage.updateSpecialty(id, req.body);

        if (!updatedSpecialty) {
          return res.status(404).json({ message: "Specialty not found" });
        }

        res.json(updatedSpecialty);
      } catch (error) {
        next(error);
      }
    }
  );

  app.delete(
    "/api/specialties/:id", 
    isAuthenticated, 
    hasPermission("canManageSpecialties"),
    (req, res, next) => {
      if (req.user!.role !== 'ceo' && req.user!.role !== 'admin') { // Corrected
        return res.status(403).json({ message: "Only CEO and Admin can manage specialties" });
      }
      next();
    },
    async (req, res, next) => {
      try {
        const id = parseInt(req.params.id);
        const success = await storage.deleteSpecialty(id);

        if (!success) {
          return res.status(404).json({ message: "Specialty not found" });
        }

        res.status(204).end();
      } catch (error) {
        next(error);
      }
    }
  );

  // Categories
  app.get("/api/categories", isAuthenticated, async (req, res, next) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/categories/:id", isAuthenticated, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const category = await storage.getCategory(id);

      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      res.json(category);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/categories", isAuthenticated, hasPermission("canAddItems"), async (req, res, next) => {
    try {
      const categoryData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(categoryData);
      res.status(201).json(category);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/categories/:id", isAuthenticated, hasPermission("canAddItems"), async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const categoryData = insertCategorySchema.parse(req.body);

      // Check if the category exists first
      const existingCategory = await storage.getCategory(id);
      if (!existingCategory) {
        return res.status(404).json({ message: "Category not found" });
      }

      // Update the category
      const updatedCategory = await storage.updateCategory(id, categoryData);
      res.json(updatedCategory);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/categories/:id", isAuthenticated, hasPermission("canAddItems"), async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);

      // Check if category is being used by any stock items
      const stockItems = await storage.getStockItemsByCategory(id);
      if (stockItems.length > 0) {
        return res.status(400).json({ 
          message: "Cannot delete category that is in use by stock items" 
        });
      }

      // Delete the category
      const success = await storage.deleteCategory(id);
      if (!success) {
        return res.status(404).json({ message: "Category not found" });
      }

      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  // Stock Items
  app.get("/api/stock-items", isAuthenticated, async (req, res, next) => {
    try {
      const stockItems = await storage.getStockItems();
      res.json(stockItems);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/stock-items/expiring", isAuthenticated, async (req, res, next) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const items = await storage.getExpiringItems(days);
      res.json(items);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/stock-items/:id", isAuthenticated, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.getStockItem(id);

      if (!item) {
        return res.status(404).json({ message: "Stock item not found" });
      }

      res.json(item);
    } catch (error) {
      next(error);
    }
  });

  app.post(
    "/api/stock-items", 
    isAuthenticated, 
    hasPermission("canAddItems"), 
    upload.single("image"), 
    async (req, res, next) => {
      try {
        // Parse form data properly
        const stockData = {
          ...req.body,
          // Ensure numeric fields are properly converted
          quantity: req.body.quantity ? parseInt(req.body.quantity) : undefined,
          categoryId: req.body.categoryId ? parseInt(req.body.categoryId) : undefined,
          // Convert price from dollars to cents (stored as integer)
          price: req.body.price ? Math.round(parseFloat(req.body.price) * 100) : 0,
          // Add the current user as creator
          createdBy: req.user!.id
        };

        // Handle image upload
        if (req.file) {
          stockData.imageUrl = `/uploads/${req.file.filename}`;
        }

        console.log("Received stock data:", stockData);

        // Validate data with extended schema
        const validatedData = extendedInsertStockItemSchema.parse(stockData);

        // Create stock item
        const stockItem = await storage.createStockItem(validatedData);
        res.status(201).json(stockItem);
      } catch (error) {
        console.error("Stock item creation error:", error);
        next(error);
      }
    }
  );

  app.put(
    "/api/stock-items/:id", 
    isAuthenticated, 
    hasPermission("canEditItems"), 
    upload.single("image"), 
    async (req, res, next) => {
      try {
        const id = parseInt(req.params.id);

        // Parse and convert form data
        const updateData = {
          ...req.body,
          // Convert numeric strings to numbers if they exist
          quantity: req.body.quantity !== undefined ? parseInt(req.body.quantity) : undefined,
          categoryId: req.body.categoryId !== undefined ? parseInt(req.body.categoryId) : undefined,
          // Convert price from dollars to cents (stored as integer)
          price: req.body.price !== undefined ? Math.round(parseFloat(req.body.price) * 100) : undefined,
        };

        // Handle expiry date properly - make sure it's a valid date
        if (updateData.expiry) {
          try {
            // Check if it's already a valid date string in ISO format
            if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(updateData.expiry)) {
              // If not in ISO format, try to convert it
              updateData.expiry = new Date(updateData.expiry).toISOString();
            }
          } catch (e) {
            // If date conversion fails, remove the expiry field to prevent errors
            console.error("Date conversion error:", e);
            delete updateData.expiry;
          }
        }

        // Handle image upload
        if (req.file) {
          updateData.imageUrl = `/uploads/${req.file.filename}`;

          // Delete old image if exists
          const oldItem = await storage.getStockItem(id);
          if (oldItem?.imageUrl) {
            const oldImagePath = path.join(process.cwd(), oldItem.imageUrl.replace(/^\/uploads\//, 'uploads/'));
            if (fs.existsSync(oldImagePath)) {
              fs.unlinkSync(oldImagePath);
            }
          }
        }

        console.log("Updating stock item:", id, updateData);

        const updatedItem = await storage.updateStockItem(id, updateData);

        if (!updatedItem) {
          return res.status(404).json({ message: "Stock item not found" });
        }

        res.json(updatedItem);
      } catch (error) {
        console.error("Stock item update error:", error);
        next(error);
      }
    }
  );

  app.delete(
    "/api/stock-items/:id", 
    isAuthenticated, 
    hasPermission("canRemoveItems"), 
    async (req, res, next) => {
      try {
        const id = parseInt(req.params.id);

        // Get item to check for image
        const item = await storage.getStockItem(id);
        if (!item) {
          return res.status(404).json({ message: "Stock item not found" });
        }

        // Delete associated image if exists
        if (item.imageUrl) {
          const imagePath = path.join(process.cwd(), item.imageUrl.replace(/^\/uploads\//, 'uploads/'));
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
          }
        }

        const success = await storage.deleteStockItem(id);

        if (!success) {
          return res.status(404).json({ message: "Stock item not found" });
        }

        res.status(204).end();
      } catch (error) {
        next(error);
      }
    }
  );

  // Stock Allocations
  app.get("/api/allocations", isAuthenticated, async (req, res, next) => {
    try {
      const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
      const allocations = await storage.getAllocations(userId);
      res.json(allocations);
    } catch (error) {
      next(error);
    }
  });

  // Stock Movements
  app.get("/api/movements", isAuthenticated, async (req, res, next) => {
    try {
      const movements = await storage.getMovements();
      res.json(movements);
    } catch (error) {
      next(error);
    }
  });

  app.post(
    "/api/movements", 
    isAuthenticated, 
    hasPermission("canMoveStock"), 
    async (req, res, next) => {
      try {
        let movementData = req.body;

        // Convert numeric strings to numbers
        if (movementData.stockItemId) movementData.stockItemId = parseInt(movementData.stockItemId);
        if (movementData.fromUserId) movementData.fromUserId = parseInt(movementData.fromUserId);
        if (movementData.toUserId) movementData.toUserId = parseInt(movementData.toUserId);
        if (movementData.quantity) movementData.quantity = parseInt(movementData.quantity);

        // Set current user as the one who moved the stock
        movementData.movedBy = req.user!.id;

        // Validate
        const validatedData = insertStockMovementSchema.parse(movementData);

        // Check if source has enough stock
        const stockItem = await storage.getStockItem(validatedData.stockItemId);
        if (!stockItem) {
          return res.status(404).json({ message: "Stock item not found" });
        }

        // If moving from central inventory, check main stock
        if (!validatedData.fromUserId) {
          if (stockItem.quantity < validatedData.quantity) {
            return res.status(400).json({ message: "Not enough stock available" });
          }

          // Update central inventory quantity
          await storage.updateStockItem(stockItem.id, {
            quantity: stockItem.quantity - validatedData.quantity
          });
        } else {
          // If moving from a user, check user's allocation
          const userAllocations = await storage.getAllocations(validatedData.fromUserId);
          const sourceAllocation = userAllocations.find(
            a => a.stockItemId === validatedData.stockItemId
          );

          if (!sourceAllocation || sourceAllocation.quantity < validatedData.quantity) {
            return res.status(400).json({ message: "Source user does not have enough stock" });
          }

          // Update source user's allocation
          await storage.updateAllocation(sourceAllocation.id, {
            quantity: sourceAllocation.quantity - validatedData.quantity
          });
        }

        // Update or create target user's allocation
        const targetAllocations = await storage.getAllocations(validatedData.toUserId);
        const targetAllocation = targetAllocations.find(
          a => a.stockItemId === validatedData.stockItemId
        );

        if (targetAllocation) {
          // Update existing allocation
          await storage.updateAllocation(targetAllocation.id, {
            quantity: targetAllocation.quantity + validatedData.quantity
          });
        } else {
          // Create new allocation
          await storage.createAllocation({
            userId: validatedData.toUserId,
            stockItemId: validatedData.stockItemId,
            quantity: validatedData.quantity,
            allocatedBy: validatedData.movedBy
          });
        }

        // Create movement record
        const movement = await storage.createMovement(validatedData);
        res.status(201).json(movement);
      } catch (error) {
        next(error);
      }
    }
  );

  // Users
  app.get("/api/users", isAuthenticated, async (req, res, next) => {
    try {
      const role = req.query.role as string | undefined;

      let users;
      if (role) {
        users = await storage.getUsersByRole(role as any);
      } else {
        users = await storage.getUsers();
      }

      // Remove passwords from response
      const safeUsers = users.map(u => {
        const { password, ...userWithoutPassword } = u;
        return userWithoutPassword;
      });

      res.json(safeUsers);
    } catch (error) {
      next(error);
    }
  });

  // Get a single user
  app.get("/api/users/:id", isAuthenticated, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const user = await storage.getUser(id);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Remove password from response
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      next(error);
    }
  });

  // Update a user
  app.put(
    "/api/users/:id", 
    isAuthenticated, 
    hasPermission("canManageUsers"), 
    async (req, res, next) => {
      try {
        const id = parseInt(req.params.id);
        const userData = req.body;

        // If password is provided, hash it
        if (userData.password) {
          const { hashPassword } = await import('./auth.js');
          userData.password = await hashPassword(userData.password);
        }

        const updatedUser = await storage.updateUser(id, userData);

        if (!updatedUser) {
          return res.status(404).json({ message: "User not found" });
        }

        // Remove password from response
        const { password, ...safeUser } = updatedUser;
        res.json(safeUser);
      } catch (error) {
        next(error);
      }
    }
  );

  // Delete a user
  app.delete(
    "/api/users/:id", 
    isAuthenticated, 
    hasPermission("canManageUsers"), 
    async (req, res, next) => {
      try {
        const id = parseInt(req.params.id);

        // Don't allow deleting the current user
        if (id === req.user!.id) {
          return res.status(400).json({ message: "Cannot delete your own account" });
        }

        const success = await storage.deleteUser(id);

        if (!success) {
          return res.status(404).json({ message: "User not found" });
        }

        res.status(204).end();
      } catch (error) {
        next(error);
      }
    }
  );

  // Create HTTP server
  const httpServer = createServer(app);

  return httpServer;
}