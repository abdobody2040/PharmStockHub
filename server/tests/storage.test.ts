import assert from 'assert';
import { MemStorage } from '../storage'; // Adjust path as needed
import type { 
  InsertSpecialty, Specialty,
  InsertUser, User,
  InsertStockItem, StockItem,
  InsertStockMovement, StockMovement,
  RoleType
} from '@shared/schema'; // Adjust path as needed

// Helper function to run tests and log results
async function runTest(description: string, testFn: () => Promise<void>) {
  console.log(`\n[TEST] ${description}`);
  try {
    await testFn();
    console.log(`[PASS] ${description}`);
  } catch (error) {
    console.error(`[FAIL] ${description}`);
    console.error(error);
    process.exitCode = 1; // Indicate failure
  }
}

async function runSuite(suiteDescription: string, suiteFn: () => Promise<void>) {
  console.log(`\n--- Test Suite: ${suiteDescription} ---`);
  await suiteFn();
}

(async () => {
  const storage = new MemStorage();

  await runSuite('MemStorage - createSpecialty', async () => {
    await runTest('should create a specialty with all properties and set description to null if undefined', async () => {
      const newSpecialtyData: InsertSpecialty = { name: 'Cardiology' }; // description is undefined
      const createdSpecialty = await storage.createSpecialty(newSpecialtyData);
      
      assert.ok(createdSpecialty.id, 'Specialty should have an ID');
      assert.strictEqual(createdSpecialty.name, 'Cardiology', 'Name should match');
      assert.strictEqual(createdSpecialty.description, null, 'Description should be null as it was not provided');
      assert.ok(createdSpecialty.createdAt instanceof Date, 'createdAt should be a Date');

      const retrievedSpecialty = await storage.getSpecialty(createdSpecialty.id);
      assert.deepStrictEqual(retrievedSpecialty, createdSpecialty, 'Retrieved specialty should match created one');
    });

    await runTest('should create a specialty with provided description', async () => {
      const newSpecialtyData: InsertSpecialty = { name: 'Neurology', description: 'Brain and nerves' };
      const createdSpecialty = await storage.createSpecialty(newSpecialtyData);

      assert.strictEqual(createdSpecialty.name, 'Neurology', 'Name should match');
      assert.strictEqual(createdSpecialty.description, 'Brain and nerves', 'Description should match');
      
      const retrievedSpecialty = await storage.getSpecialty(createdSpecialty.id);
      assert.deepStrictEqual(retrievedSpecialty, createdSpecialty, 'Retrieved specialty should match created one');
    });
  });

  await runSuite('MemStorage - createUser', async () => {
    await runTest('should create a user and set optional fields to null if not provided', async () => {
      const newUserData: InsertUser = {
        username: 'testuser',
        password: 'password123',
        name: 'Test User',
        role: 'medicalRep',
        // region, avatar, specialtyId are not provided
      };
      const createdUser = await storage.createUser(newUserData);

      assert.ok(createdUser.id, 'User should have an ID');
      assert.strictEqual(createdUser.username, 'testuser');
      assert.strictEqual(createdUser.name, 'Test User');
      assert.strictEqual(createdUser.role, 'medicalRep');
      assert.strictEqual(createdUser.region, null, 'Region should be null');
      assert.strictEqual(createdUser.avatar, null, 'Avatar should be null');
      assert.strictEqual(createdUser.specialtyId, null, 'SpecialtyId should be null');
      assert.ok(createdUser.createdAt instanceof Date, 'createdAt should be a Date');

      const retrievedUser = await storage.getUser(createdUser.id);
      assert.deepStrictEqual(retrievedUser, createdUser, 'Retrieved user should match created one');
    });

    await runTest('should create a user with all optional fields provided', async () => {
      const newUserData: InsertUser = {
        username: 'fulluser',
        password: 'password123',
        name: 'Full User',
        role: 'admin',
        region: 'North',
        avatar: '/path/to/avatar.png',
        specialtyId: 1, // Assuming a specialty with ID 1 might exist from MemStorage init
      };
      const createdUser = await storage.createUser(newUserData);

      assert.strictEqual(createdUser.region, 'North');
      assert.strictEqual(createdUser.avatar, '/path/to/avatar.png');
      assert.strictEqual(createdUser.specialtyId, 1);

      const retrievedUser = await storage.getUser(createdUser.id);
      assert.deepStrictEqual(retrievedUser, createdUser, 'Retrieved user should match created one');
    });
  });

  await runSuite('MemStorage - createStockItem', async () => {
    // Need a user and category for creating stock items
    const category = await storage.createCategory({ name: 'Test Category', color: 'blue' });
    const user = await storage.createUser({ username: 'stockuser', password: 'pw', name: 'Stocker', role: 'stockManager' });

    await runTest('should create a stock item and set optional fields to null if not provided', async () => {
      const newItemData: InsertStockItem = {
        name: 'Basic Item',
        categoryId: category.id,
        quantity: 100,
        createdBy: user.id,
        // price, specialtyId, expiry, uniqueNumber, imageUrl, notes are not provided
      };
      const createdItem = await storage.createStockItem(newItemData);

      assert.ok(createdItem.id, 'StockItem should have an ID');
      assert.strictEqual(createdItem.name, 'Basic Item');
      assert.strictEqual(createdItem.categoryId, category.id);
      assert.strictEqual(createdItem.quantity, 100);
      assert.strictEqual(createdItem.createdBy, user.id);
      assert.strictEqual(createdItem.price, null, 'Price should be null');
      assert.strictEqual(createdItem.specialtyId, null, 'SpecialtyId should be null');
      assert.strictEqual(createdItem.expiry, null, 'Expiry should be null');
      assert.strictEqual(createdItem.uniqueNumber, null, 'UniqueNumber should be null');
      assert.strictEqual(createdItem.imageUrl, null, 'ImageUrl should be null');
      assert.strictEqual(createdItem.notes, null, 'Notes should be null');
      assert.ok(createdItem.createdAt instanceof Date, 'createdAt should be a Date');
      
      const retrievedItem = await storage.getStockItem(createdItem.id);
      assert.deepStrictEqual(retrievedItem, createdItem, 'Retrieved item should match created one');
    });

    await runTest('should create a stock item with all optional fields provided', async () => {
      const expiryDate = new Date();
      const newItemData: InsertStockItem = {
        name: 'Full Item',
        categoryId: category.id,
        quantity: 50,
        price: 1999, // Price in cents
        specialtyId: 1, // Assuming specialty ID 1 exists
        expiry: expiryDate,
        uniqueNumber: 'UNIQUE123',
        imageUrl: '/path/to/image.png',
        notes: 'This is a full item.',
        createdBy: user.id,
      };
      const createdItem = await storage.createStockItem(newItemData);

      assert.strictEqual(createdItem.price, 1999);
      assert.strictEqual(createdItem.specialtyId, 1);
      assert.deepStrictEqual(createdItem.expiry, expiryDate);
      assert.strictEqual(createdItem.uniqueNumber, 'UNIQUE123');
      assert.strictEqual(createdItem.imageUrl, '/path/to/image.png');
      assert.strictEqual(createdItem.notes, 'This is a full item.');

      const retrievedItem = await storage.getStockItem(createdItem.id);
      assert.deepStrictEqual(retrievedItem, createdItem, 'Retrieved item should match created one');
    });
  });

  await runSuite('MemStorage - createMovement', async () => {
    const fromUser = await storage.createUser({ username: 'fromUser', password: 'pw', name: 'From User', role: 'medicalRep' });
    const toUser = await storage.createUser({ username: 'toUser', password: 'pw', name: 'To User', role: 'medicalRep' });
    const categoryForMovement = await storage.createCategory({ name: 'Movement Category', color: 'red' });
    const itemForMovement = await storage.createStockItem({ 
        name: 'Movable Item', 
        categoryId: categoryForMovement.id, 
        quantity: 10, 
        createdBy: fromUser.id 
    });

    await runTest('should create a movement and set optional fields to null if not provided', async () => {
      const newMovementData: InsertStockMovement = {
        stockItemId: itemForMovement.id,
        toUserId: toUser.id,
        quantity: 5,
        movedBy: fromUser.id,
        // fromUserId, notes are not provided
      };
      const createdMovement = await storage.createMovement(newMovementData);

      assert.ok(createdMovement.id, 'Movement should have an ID');
      assert.strictEqual(createdMovement.stockItemId, itemForMovement.id);
      assert.strictEqual(createdMovement.toUserId, toUser.id);
      assert.strictEqual(createdMovement.quantity, 5);
      assert.strictEqual(createdMovement.movedBy, fromUser.id);
      assert.strictEqual(createdMovement.fromUserId, null, 'fromUserId should be null');
      assert.strictEqual(createdMovement.notes, null, 'notes should be null');
      assert.ok(createdMovement.movedAt instanceof Date, 'movedAt should be a Date');

      // As MemStorage doesn't have getMovementById, we check if it's in getMovements()
      const movements = await storage.getMovements();
      const foundMovement = movements.find(m => m.id === createdMovement.id);
      assert.deepStrictEqual(foundMovement, createdMovement, 'Retrieved movement should match created one');
    });

    await runTest('should create a movement with all optional fields provided', async () => {
      const newMovementData: InsertStockMovement = {
        stockItemId: itemForMovement.id,
        fromUserId: fromUser.id,
        toUserId: toUser.id,
        quantity: 2,
        notes: 'Transfer for demo',
        movedBy: fromUser.id,
      };
      const createdMovement = await storage.createMovement(newMovementData);
      
      assert.strictEqual(createdMovement.fromUserId, fromUser.id);
      assert.strictEqual(createdMovement.notes, 'Transfer for demo');

      const movements = await storage.getMovements();
      const foundMovement = movements.find(m => m.id === createdMovement.id);
      assert.deepStrictEqual(foundMovement, createdMovement, 'Retrieved movement should match created one');
    });
  });

  // Final check for any errors during tests
  if (process.exitCode === 1) {
    console.error("\n--- Some tests failed. ---");
  } else {
    console.log("\n--- All tests passed successfully! ---");
  }
})();

console.log('Running MemStorage tests...');

// To run this file: node server/tests/storage.test.js (or .ts if using ts-node)
// Make sure paths to storage.ts and @shared/schema are correct.
// Adjust tsconfig.json or use a loader like ts-node if running TypeScript directly.
// Example tsconfig.json for node:
// {
//   "compilerOptions": {
//     "module": "commonjs",
//     "target": "esnext",
//     "moduleResolution": "node",
//     "esModuleInterop": true,
//     "strict": true,
//     "skipLibCheck": true,
//     "baseUrl": ".",
//     "paths": {
//       "@/*": ["./client/src/*"],
//       "@shared/*": ["./shared/*"]
//     }
//   },
//   "include": ["server/**/*.ts"]
// }
// Command: npx ts-node server/tests/storage.test.ts (assuming ts-node and typescript are installed)
// Or compile first: npx tsc --project ./server/tsconfig.json (if you have a server-specific tsconfig)
// Then run: node server/dist/tests/storage.test.js
