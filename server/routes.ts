import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import * as localAuth from "./auth/local"; // Keep for session destruction in logout
import * as zammadAuth from "./auth/zammad-auth"; // Import the new Zammad auth
import * as adAuth from "./auth/ad"; // Keep AD auth for employees
import * as zammadController from "./controllers/zammad-controller";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { insertTicketSchema } from "@shared/schema";

// Generate a secret key for session
const SESSION_SECRET = process.env.SESSION_SECRET || "tecknet-secret-key-change-in-production";

export async function registerRoutes(app: Express): Promise<Server> {
  // Create a PostgreSQL pool for sessions using the DATABASE_URL
  const pgPool = new pg.Pool({
    connectionString: "postgresql://zammad:zammad@172.24.57.66:5432/zammad_production"
  });
  
  // Setup PostgreSQL session store
  const PgSession = connectPgSimple(session);
  
  // Setup express-session middleware with PostgreSQL store
  app.use(
    session({
      store: new PgSession({
        pool: pgPool,
        tableName: 'tecknet_session', // Custom table name to avoid conflicts
        createTableIfMissing: true // Auto-create the table if it doesn't exist
      }),
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    })
  );

  // Combined logout function that handles both customer and employee sessions
  function combinedLogout(req: Request, res: Response) {
    if (req.session) {
      console.log(`Logging out user:`, req.session.user || req.session.adUser);
      
      req.session.destroy(err => {
        if (err) {
          console.error("Error destroying session:", err);
          return res.status(500).json({ message: "Error logging out" });
        }
        return res.json({ message: "Logged out successfully" });
      });
    } else {
      return res.json({ message: "No active session" });
    }
  }

  // Auth routes - Keep both authentication methods but on different routes
  app.post("/api/auth/login", zammadAuth.loginCustomer); // Zammad login for customers
  app.post("/api/auth/ad-login", adAuth.loginWithAD); // Keep AD auth for employees
  app.post("/api/auth/logout", combinedLogout); // Use combined logout for both types of users
  app.post('/api/contact', zammadController.createContactTicket);
  
  // Get current user - This logic is correct, keep it as is
  app.get("/api/me", (req: Request, res: Response) => {
    if (req.session && req.session.isAuthenticated) {
      if (req.session.user) {
        // For customer authentication (using Zammad)
        return res.json({ user: req.session.user, type: "customer" });
      } else if (req.session.adUser) {
        // For employee authentication (using AD)
        return res.json({ user: req.session.adUser, type: "employee" });
      }
    }
    return res.status(401).json({ message: "Not authenticated" });
  });
  
  // Middleware to check if authenticated by either method
  function isAuthenticatedAny(req: Request, res: Response, next: NextFunction) {
    if (req.session && req.session.isAuthenticated) {
      return next();
    }
    return res.status(401).json({ message: "Not authenticated" });
  }
  
  // Application Links routes
  // app.get("/api/application-links", adAuth.isADAuthenticated, async (req: Request, res: Response) => {
  //   try {
  //     const links = await storage.getAllApplicationLinks();
  //     return res.json({ links });
  //   } catch (error) {
  //     console.error("Error getting application links:", error);
  //     return res.status(500).json({ message: "Server error" });
  //   }
  // });
  // In routes.ts - update the application-links endpoint
// In routes.ts - update the application-links endpoint using session data
  // app.get("/api/application-links", isAuthenticatedAny, async (req: Request, res: Response) => {
  //   try {
  //     // Get all application links first
  //     const links = await storage.getAllApplicationLinks();
      
  //     // For customer users, return an empty list or customer-specific links
  //     if (req.session.user) {
  //       // For now, return no links for customers - you might want to customize this
  //       return res.json({ links: [] });
  //     }
      
  //     // For employee users, filter based on role or department from session
  //     if (req.session.adUser) {
  //       const userDepartment = req.session.adUser.department || 'Unknown';
  //       console.log(`[APP LINKS] User department: ${userDepartment}, role: ${req.session.adUser.role}`);
        
  //       // Admin or IT department users get all apps
  //       if (req.session.adUser.role === 'admin' || 
  //           userDepartment === 'IT') {
  //         console.log('[APP LINKS] Returning all application links for admin/IT user');
  //         return res.json({ links });
  //       }
        
  //       // Other users only get Zammad and OnlyOffice
  //       const filteredLinks = links.filter(link => {
  //         const name = link.name.toLowerCase();
  //         return name.includes('zammad') || name.includes('onlyoffice');
  //       });
        
  //       console.log(`[APP LINKS] Returning filtered links (${filteredLinks.length}) for non-IT user`);
  //       return res.json({ links: filteredLinks });
  //     }
      
  //     // If we reach here, something's wrong with the authentication
  //     return res.status(401).json({ message: "Not authenticated" });
  //   } catch (error) {
  //     console.error("Error getting application links:", error);
  //     return res.status(500).json({ message: "Server error" });
  //   }
  // });

  // app.get("/api/application-links", isAuthenticatedAny, async (req: Request, res: Response) => {
  //   try {
  //     // Get all application links first
  //     const links = await storage.getAllApplicationLinks();
      
  //     console.log(`[APP LINKS DEBUG] session data:`, JSON.stringify(req.session));
      
  //     // For customer users, return an empty list or customer-specific links
  //     if (req.session.user) {
  //       console.log(`[APP LINKS] Customer user - returning no links`);
  //       return res.json({ links: [] });
  //     }
      
  //     // For employee users, filter based on role or department from session
  //     if (req.session.adUser) {
  //       // Check if we need to temporarily override the department for testing
  //       // Remove this in production
  //       if (req.session.adUser.username === "Adrian_IT") {
  //         console.log(`[APP LINKS] Force-setting department to IT for Adrian_IT`);
  //         req.session.adUser.department = "IT";
  //       }
        
  //       const userDepartment = req.session.adUser.department || 'Unknown';
  //       console.log(`[APP LINKS] User: ${req.session.adUser.username}`);
  //       console.log(`[APP LINKS] Department: "${userDepartment}"`);
  //       console.log(`[APP LINKS] Role: ${req.session.adUser.role}`);
        
  //       // Admin users or IT department users get all apps
  //       if (req.session.adUser.role === 'admin' || userDepartment === 'IT') {
  //         console.log('[APP LINKS] User qualifies for all apps - admin or IT');
  //         return res.json({ links });
  //       }
        
  //       // Other users only get Zammad and OnlyOffice
  //       const filteredLinks = links.filter(link => {
  //         const name = link.name.toLowerCase();
  //         return name.includes('zammad') || name.includes('onlyoffice');
  //       });
        
  //       console.log(`[APP LINKS] Returning filtered links (${filteredLinks.length}) for non-IT user`);
  //       return res.json({ links: filteredLinks });
  //     }
      
  //     // If we reach here, something's wrong with the authentication
  //     return res.status(401).json({ message: "Not authenticated" });
  //   } catch (error) {
  //     console.error("Error getting application links:", error);
  //     return res.status(500).json({ message: "Server error" });
  //   }
  // });
  app.get("/api/application-links", isAuthenticatedAny, async (req: Request, res: Response) => {
    try {
      // Get all application links first
      const links = await storage.getAllApplicationLinks();
      
      // For customer users, return an empty list or customer-specific links
      if (req.session.user) {
        console.log(`[APP LINKS] Customer user - returning no links`);
        return res.json({ links: [] });
      }
      
      // For employee users, filter based on role or department from session
      if (req.session.adUser) {
        // Temporary override for Adrian_IT
        if (req.session.adUser.username === "Adrian_IT") {
          console.log(`[APP LINKS] Setting department to IT for Adrian_IT for testing`);
          // This is a temporary solution until we fix the AD extraction
          req.session.adUser.department = "IT";
          
          // Save the session to persist the change
          await new Promise<void>((resolve, reject) => {
            req.session.save((err) => {
              if (err) {
                console.error("Error saving session:", err);
                reject(err);
              } else {
                resolve();
              }
            });
          });
        }
        
        const userDepartment = req.session.adUser.department || 'Unknown';
        console.log(`[APP LINKS] User: ${req.session.adUser.username}`);
        console.log(`[APP LINKS] Department: "${userDepartment}"`);
        console.log(`[APP LINKS] Role: ${req.session.adUser.role}`);
        
        // Admin users or IT department users get all apps
        if (req.session.adUser.role === 'admin' || userDepartment === 'IT') {
          console.log('[APP LINKS] User qualifies for all apps - admin or IT');
          return res.json({ links });
        }
        
        // Other users only get Zammad and OnlyOffice
        const filteredLinks = links.filter(link => {
          const name = link.name.toLowerCase();
          return name.includes('zammad') || name.includes('onlyoffice');
        });
        
        console.log(`[APP LINKS] Returning filtered links (${filteredLinks.length}) for non-IT user`);
        return res.json({ links: filteredLinks });
      }
      
      // If we reach here, something's wrong with the authentication
      return res.status(401).json({ message: "Not authenticated" });
    } catch (error) {
      console.error("Error getting application links:", error);
      return res.status(500).json({ message: "Server error" });
    }
  });
  // Route to reset application links (admin only)
  app.post("/api/admin/reset-app-links", adAuth.isADAuthenticated, adAuth.isADAdmin, async (req: Request, res: Response) => {
    try {
      // Clear all existing application links
      await storage.clearApplicationLinks();
      
      // Initialize with the new set of links
      const links = await storage.initializeAndGetApplicationLinks();
      
      return res.json({ 
        message: "Application links have been reset", 
        links 
      });
    } catch (error) {
      console.error("Error resetting application links:", error);
      return res.status(500).json({ message: "Server error" });
    }
  });
  
  // Subscription routes - Only for authenticated customers
  app.get("/api/subscriptions", zammadAuth.isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!req.session?.user?.id) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const subscriptions = await storage.getSubscriptionsByUserId(req.session.user.id);
      return res.json({ subscriptions });
    } catch (error) {
      console.error("Error getting subscriptions:", error);
      return res.status(500).json({ message: "Server error" });
    }
  });
  
  // Zammad Ticket routes - Use the combined auth check
  app.get("/api/tickets", isAuthenticatedAny, zammadController.getTickets);
  app.get("/api/tickets/:id", isAuthenticatedAny, zammadController.getTicketById);
  app.post("/api/tickets", isAuthenticatedAny, zammadController.createTicket);
  app.patch("/api/tickets/:id", isAuthenticatedAny, zammadController.updateTicket);
  
  // Legacy ticket routes (can be removed once Zammad integration is complete)
  app.get("/api/local-tickets", isAuthenticatedAny, async (req: Request, res: Response) => {
    try {
      let tickets;
      
      if (req.session.user) {
        // Customer tickets
        tickets = await storage.getTicketsByUserId(req.session.user.id);
      } else if (req.session.adUser) {
        // Employee or admin tickets
        if (req.session.adUser.role === "admin") {
          // Admin sees all tickets
          tickets = await storage.getAllTickets();
        } else {
          // Employee sees their tickets
          tickets = await storage.getTicketsByADUserId(req.session.adUser.id);
        }
      }
      
      return res.json({ tickets });
    } catch (error) {
      console.error("Error getting tickets:", error);
      return res.status(500).json({ message: "Server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}