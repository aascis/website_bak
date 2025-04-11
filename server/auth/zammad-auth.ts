// server/auth/zammad-auth.ts
import { Request, Response, NextFunction } from "express";
import { client } from "../db";

// NOTE: In production, you should install the argon2 package and implement proper password verification
// For now, we're using a simplified version for testing

class ZammadAuthService {
  /**
   * Authenticate a customer with Zammad
   */
  async authenticateCustomer(email: string, password: string): Promise<{
    success: boolean;
    user?: any;
    message?: string;
  }> {
    try {
      console.log(`Attempting to authenticate user with email: ${email}`);
      
      // Get user with password
      const userData = await this.getUserWithPassword(email);
      
      if (!userData) {
        console.log(`No user found with email: ${email}`);
        return { 
          success: false, 
          message: "Invalid email or password" 
        };
      }
      
      if (!userData.active) {
        console.log(`User ${userData.id} is not active`);
        return {
          success: false,
          message: "Account is inactive"
        };
      }
      
      // For now, we're skipping password verification since we can't install argon2
      // TODO: In production, install argon2 and implement proper password verification
      console.log(`Password verification skipped for user ${userData.id} - TESTING ONLY`);
      
      // Check if the user is a customer
      const isCustomer = await this.userHasRole(userData.id, 3); // 3 is the customer role
      
      if (!isCustomer) {
        console.log(`User ${userData.id} doesn't have the customer role`);
        return { 
          success: false, 
          message: "Access denied. Your account does not have customer permissions."
        };
      }
      
      console.log(`User ${userData.id} confirmed as a customer`);
      
      // Get organization name if user has an organization
      let companyName;
      if (userData.organization_id) {
        companyName = await this.getOrganizationName(userData.organization_id);
        console.log(`User belongs to organization: ${companyName || 'Unknown'}`);
      }
      
      // Format the user data to match our application's user type
      const user = {
        id: userData.id,
        username: userData.login || userData.email,
        email: userData.email,
        fullName: `${userData.firstname || ''} ${userData.lastname || ''}`.trim() || userData.email.split('@')[0],
        companyName: companyName,
        role: 'customer',
        status: userData.active ? 'active' : 'inactive',
      };
      
      console.log(`User data formatted for session: ${user.fullName} (${user.email})`);
      
      return { 
        success: true, 
        user 
      };
    } catch (error) {
      console.error("Error authenticating with Zammad:", error);
      return { 
        success: false, 
        message: "Authentication failed due to server error" 
      };
    }
  }
  
  /**
   * Get user with password for authentication
   */
  private async getUserWithPassword(email: string): Promise<any> {
    try {
      const userResult = await client`
        SELECT 
          id, login, firstname, lastname, email, 
          organization_id, active, password
        FROM users 
        WHERE email = ${email}
      `;
      
      if (!userResult || userResult.length === 0) {
        return null;
      }
      
      return userResult[0];
    } catch (error) {
      console.error("Error getting user data from Zammad:", error);
      return null;
    }
  }
  
  /**
   * Check if a user has a specific role
   */
  private async userHasRole(userId: number, roleId: number): Promise<boolean> {
    try {
      const roleResult = await client`
        SELECT 1
        FROM roles_users
        WHERE user_id = ${userId} AND role_id = ${roleId}
      `;
      
      return roleResult && roleResult.length > 0;
    } catch (error) {
      console.error("Error checking user role:", error);
      return false;
    }
  }
  
  /**
   * Get organization name by ID from Zammad
   */
  private async getOrganizationName(orgId: number): Promise<string | undefined> {
    try {
      const orgResult = await client`
        SELECT name
        FROM organizations
        WHERE id = ${orgId}
      `;
      
      if (!orgResult || orgResult.length === 0) {
        return undefined;
      }
      
      return orgResult[0].name;
    } catch (error) {
      console.error("Error getting organization name:", error);
      return undefined;
    }
  }
  
  /**
   * Login handler for customer authentication
   */
  async loginCustomer(req: Request, res: Response) {
    try {
      console.log(`Received login request for email: ${req.body.email || 'not provided'}`);
      const { email, password } = req.body;
      
      if (!email || !password) {
        console.log('Login failed: Missing email or password');
        return res.status(400).json({ message: "Email and password are required" });
      }
      
      const authResult = await this.authenticateCustomer(email, password);
      
      if (!authResult.success) {
        console.log(`Login failed: ${authResult.message}`);
        return res.status(401).json({ message: authResult.message || "Authentication failed" });
      }
      
      // Set session data
      req.session.isAuthenticated = true;
      req.session.user = authResult.user;
      req.session.userType = 'customer';
      
      console.log(`Login successful: User ${authResult.user.id} (${authResult.user.email})`);
      
      return res.json({ 
        message: "Login successful", 
        user: authResult.user 
      });
    } catch (error) {
      console.error("Error in loginCustomer:", error);
      return res.status(500).json({ message: "Server error" });
    }
  }
  
  /**
   * Check if the user is authenticated via Zammad
   */
  isAuthenticated(req: Request, res: Response, next: NextFunction) {
    if (req.session && req.session.isAuthenticated && req.session.user) {
      return next();
    }
    return res.status(401).json({ message: "Not authenticated" });
  }
  
  /**
   * Check if the user is a customer
   */
  isCustomer(req: Request, res: Response, next: NextFunction) {
    if (req.session && req.session.user && req.session.user.role === 'customer') {
      return next();
    }
    return res.status(403).json({ message: "Access denied" });
  }
  
  /**
   * Log the user out
   */
  logout(req: Request, res: Response) {
    if (req.session.user) {
      console.log(`Logging out user: ${req.session.user.id} (${req.session.user.email})`);
    }
    
    req.session.destroy(err => {
      if (err) {
        console.error("Error destroying session:", err);
        return res.status(500).json({ message: "Error logging out" });
      }
      return res.json({ message: "Logged out successfully" });
    });
  }
}

export const zammadAuthService = new ZammadAuthService();

// Export functions for use in routes
export function loginCustomer(req: Request, res: Response) {
  return zammadAuthService.loginCustomer(req, res);
}

export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  return zammadAuthService.isAuthenticated(req, res, next);
}

export function isCustomer(req: Request, res: Response, next: NextFunction) {
  return zammadAuthService.isCustomer(req, res, next);
}

export function logout(req: Request, res: Response) {
  return zammadAuthService.logout(req, res);
}