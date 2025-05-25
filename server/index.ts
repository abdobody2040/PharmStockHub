import express, { type Request, Response, NextFunction } from "express";
import helmet from 'helmet'; // Import helmet
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { getOrgConfig, type OrgConfig } from './config';
import { storage } from "./storage";
import { hashPassword } from "./auth";

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      orgConfig?: OrgConfig;
    }
  }
}

const app = express();

// Apply helmet middleware
app.use(helmet());

// Create default admin user if it doesn't exist
async function createDefaultAdmin() {
  try {
    const defaultAdminUsername = process.env.DEFAULT_ADMIN_USERNAME;
    const defaultAdminPassword = process.env.DEFAULT_ADMIN_PASSWORD;

    if (!defaultAdminUsername || !defaultAdminPassword) {
      console.warn(
        'Default admin creation skipped: DEFAULT_ADMIN_USERNAME or DEFAULT_ADMIN_PASSWORD not set in environment variables.'
      );
      return;
    }

    const adminExists = await storage.getUserByUsername(defaultAdminUsername);
    if (!adminExists) {
      const hashedPassword = await hashPassword(defaultAdminPassword);
      await storage.createUser({
        username: defaultAdminUsername,
        password: hashedPassword,
        name: 'Administrator',
        role: 'admin',
        region: '', // Or handle this as per your application's logic for default admin
        avatar: '', // Or handle this as per your application's logic for default admin
      });
      console.log(`Default admin user '${defaultAdminUsername}' created successfully.`);
    }
  } catch (error) {
    console.error('Error creating default admin:', error);
  }
}

createDefaultAdmin();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        if (process.env.NODE_ENV === 'production') {
          logLine += ` :: [Response body hidden in production]`;
        } else {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Organization-specific middleware
app.use((req, res, next) => {
  const orgId = req.headers['x-org-id'] as string;
  req.orgConfig = getOrgConfig(orgId);
  next();
});


(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err); // Log the error
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    // Do not throw err; the request is ended with the response above.
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();