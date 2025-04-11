import { Request, Response } from "express";
import { storage } from "../storage";
import { employeeLoginSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import ActiveDirectory from 'activedirectory2';

// AD configuration
const adConfig = {
  url: 'ldap://172.24.8.100',  // Replace with your domain controller
  baseDN: 'DC=tecknet,DC=ca',  // Replace with your domain base DN
  username: 'ldap@tecknet.ca', // Optional: service account for AD queries
  password: 'Secret55!',       // Optional: service account password
  attributes: {
    user: ['sAMAccountName', 'mail', 'displayName', 'memberOf']
  }
};

// Extract department from Organizational Unit (OU)
// Updated function to prioritize the OU structure based on your specific AD setup
function extractDepartmentFromOU(distinguishedName: string): string {
  if (!distinguishedName) return 'Unknown';
  
  console.log(`[DEBUG] Raw DN: ${distinguishedName}`);
  
  // For Active Directory, the distinguishedName is case-sensitive, so let's normalize it
  const normalizedDN = distinguishedName.toUpperCase();
  
  // Simple check for IT department - most reliable approach
  if (normalizedDN.includes('OU=IT,')) {
    console.log(`[DEBUG] Found IT department in DN`);
    return 'IT';
  }
  
  // Check for other specific departments
  if (normalizedDN.includes('OU=FINANCE,')) return 'Finance';
  if (normalizedDN.includes('OU=HR,')) return 'HR';
  if (normalizedDN.includes('OU=DEVELOPMENT,')) return 'Development';
  
  // For development teams
  if (normalizedDN.includes('OU=BACKENDTEAM,') || 
      normalizedDN.includes('OU=FRONTENDTEAM,') || 
      normalizedDN.includes('OU=DEVOPS,') || 
      normalizedDN.includes('OU=QA_TEAM,')) {
    return 'Development';
  }
  
  console.log(`[DEBUG] No department match in: ${distinguishedName}`);
  return 'Unknown';
}

// AD authentication using activedirectory2
// export async function authenticateWithAD(username: string, password: string): Promise<{
//   success: boolean;
//   user?: {
//     username: string;
//     email?: string;
//     fullName?: string;
//     department?: string;
//   };
//   error?: string;
// }> {
//   console.log(`[AD DEBUG] Attempting to authenticate user: ${username}`);
  
//   // Handle development/test users for localhost testing
//   if (process.env.NODE_ENV !== 'production') {
//     if (username === "john.doe" && password === "password123") {
//       return {
//         success: true,
//         user: {
//           username: "john.doe",
//           email: "john.doe@tecknet.ca",
//           fullName: "John Doe",
//           department: "IT"
//         }
//       };
//     } else if (username === "jane.smith" && password === "password123") {
//       return {
//         success: true,
//         user: {
//           username: "jane.smith",
//           email: "jane.smith@tecknet.ca",
//           fullName: "Jane Smith",
//           department: "Finance"
//         }
//       };
//     } else if (username === "admin" && password === "admin123") {
//       return {
//         success: true,
//         user: {
//           username: "admin",
//           email: "admin@tecknet.ca",
//           fullName: "Admin User",
//           department: "IT"
//         }
//       };
//     }
//   }
  
//   // For production environment, use real AD authentication
//   return new Promise((resolve) => {
//     try {
//       // Create AD client
//       const ad = new ActiveDirectory(adConfig);
      
//       // Normalize username (remove domain if present)
//       const userPrincipal = username.includes('@') ? username : `${username}@tecknet.ca`;
//       const sAMAccountName = username.includes('@') ? username.split('@')[0] : username;
      
//       // Authenticate with AD
//       ad.authenticate(userPrincipal, password, (err, auth) => {
//         if (err) {
//           console.error(`[AD DEBUG] Authentication error for ${username}:`, err);
//           return resolve({
//             success: false,
//             error: "AD authentication error: " + (err.message || JSON.stringify(err))
//           });
//         }
        
//         if (!auth) {
//           console.log(`[AD DEBUG] Authentication failed for: ${username}`);
//           return resolve({
//             success: false,
//             error: "Invalid AD credentials"
//           });
//         }
        
//         // Authentication successful, get user details
//         ad.findUser(sAMAccountName, (err, user) => {
//           if (err || !user) {
//             console.log(`[AD DEBUG] User found in AD but could not retrieve details: ${username}`);
//             return resolve({
//               success: true,
//               user: {
//                 username: sAMAccountName,
//                 email: `${sAMAccountName}@tecknet.ca`,
//                 fullName: sAMAccountName,
//                 department: 'Unknown'
//               }
//             });
//           }
          
//           console.log(`[AD DEBUG] Authentication successful for: ${username}`);
          
//           // Extract department from distinguishedName
//           const department = extractDepartmentFromOU(user.dn);
//           console.log(`[AD DEBUG] Extracted department for ${username}: ${department}`);
          
//           return resolve({
//             success: true,
//             user: {
//               username: sAMAccountName,
//               email: user.mail || user.userPrincipalName || `${sAMAccountName}@tecknet.ca`,
//               fullName: user.displayName || user.cn || sAMAccountName,
//               department: department
//             }
//           });
//         });
//       });
//     } catch (error) {
//       console.error(`[AD DEBUG] Unexpected error during AD authentication:`, error);
//       resolve({
//         success: false,
//         error: "Unexpected authentication error"
//       });
//     }
//   });
// }
export async function authenticateWithAD(username: string, password: string): Promise<{
  success: boolean;
  user?: any;
  error?: string;
}> {
  try {
    console.log(`[AD DEBUG] Attempting to authenticate user: ${username}`);
    
    // Create AD config
    const config = {
      url: 'ldap://172.24.8.100',
      baseDN: 'dc=tecknet,dc=ca',
      username: username + '@tecknet.ca',
      password: password
    };
    
    // Initialize AD client
    const ad = new ActiveDirectory(config);
    
    // Get user information from AD
    return new Promise((resolve) => {
      ad.findUser(username, (err, user) => {
        if (err) {
          console.log(`[AD DEBUG] Error authenticating: ${err.message}`);
          resolve({ success: false, error: "Authentication failed: " + err.message });
          return;
        }
        
        if (!user) {
          console.log(`[AD DEBUG] User not found: ${username}`);
          resolve({ success: false, error: "User not found" });
          return;
        }
        
        console.log(`[AD DEBUG] Authentication successful for: ${username}`);
        console.log(`[AD DEBUG] User DN: ${user.dn}`);
        
        // Extract department based on OU structure
        // Now extract the department more reliably
        let department = 'Unknown';
        if (user.dn && user.dn.includes('OU=IT,')) {
          department = 'IT';
        } else if (user.dn && user.dn.includes('OU=Finance,')) {
          department = 'Finance';
        } else if (user.dn && user.dn.includes('OU=HR,')) {
          department = 'HR';
        }
        
        console.log(`[AD DEBUG] Extracted department for ${username}: ${department}`);
        
        // Return success with user information
        resolve({
          success: true,
          user: {
            username: username,
            email: user.mail || username + '@tecknet.ca',
            fullName: user.displayName || username,
            department: department
          }
        });
      });
    });
  } catch (error) {
    console.error("AD Authentication error:", error);
    return { success: false, error: "Authentication system error" };
  }
}

// Login with AD credentials
// Add at the beginning of the loginWithAD function

// Update the loginWithAD function without changing the database schema
export async function loginWithAD(req: Request, res: Response) {
  try {
    console.log("[AUTH] AD login attempt with session ID:", req.sessionID);
    console.log(`[AD DEBUG] Full request body:`, JSON.stringify(req.body));
    // Validate request data
    const { username, password } = employeeLoginSchema.parse(req.body);
    
    // Authenticate with AD
    const adResult = await authenticateWithAD(username, password);
    
    if (!adResult.success || !adResult.user) {
      return res.status(401).json({ message: adResult.error || "Authentication failed" });
    }
    
    // Check if AD user exists in our database
    let adUser = await storage.getADUserByUsername(adResult.user.username);
    
    // If user doesn't exist in our database, create them
    if (!adUser) {
      adUser = await storage.createADUser({
        username: adResult.user.username,
        email: adResult.user.email,
        fullName: adResult.user.fullName,
        role: username === "admin" ? 'admin' : 'employee',
        lastLogin: new Date(),
      });
    } else {
      // Update last login time
      adUser = await storage.updateADUser(adUser.id, { 
        lastLogin: new Date(),
        email: adResult.user.email || adUser.email,
        fullName: adResult.user.fullName || adUser.fullName
      }) || adUser;
    }
    
    // Set user in session - make sure session exists
    if (!req.session) {
      console.error("[AUTH] Session object not available in request");
      return res.status(500).json({ message: "Session management error" });
    }
    
    // Store the department in the session rather than the database
    const adUserWithDepartment = {
      ...adUser,
      department: adResult.user.department // Add department from AD
    };
    
    // Save session data
    req.session.adUser = adUserWithDepartment;
    req.session.isAuthenticated = true;
    
    console.log("[AUTH] User authenticated:", adUser.username, "Department:", adResult.user.department);
    
    // Force session save to ensure it's stored before responding
    req.session.save((err) => {
      if (err) {
        console.error("[AUTH] Error saving session:", err);
        return res.status(500).json({ message: "Session save error" });
      }
      
      // Return user data with department
      return res.status(200).json({ 
        user: adUserWithDepartment, // Include department in response
        type: "employee",
        sessionId: req.sessionID
      });
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.message });
    }
    console.error('[AUTH] AD Login error:', error);
    return res.status(500).json({ message: "Server error during AD login" });
  }
}

// Check if user is authenticated with AD
export function isADAuthenticated(req: Request, res: Response, next: Function) {
  if (req.session && req.session.isAuthenticated && req.session.adUser) {
    return next();
  }
  return res.status(401).json({ message: "Not authenticated with AD" });
}

// Check if user is an admin
export function isADAdmin(req: Request, res: Response, next: Function) {
  if (req.session && req.session.adUser && req.session.adUser.role === 'admin') {
    return next();
  }
  return res.status(403).json({ message: "Not authorized" });
}

// Check if user is in IT department
export function isITDepartment(req: Request, res: Response, next: Function) {
  if (req.session && req.session.adUser && 
      (req.session.adUser.role === 'admin' || 
       req.session.adUser.department === 'IT')) {
    return next();
  }
  return res.status(403).json({ message: "Not authorized - IT department only" });
}