import { Request, Response } from 'express';
import { zammadService } from '../services/zammad';
import { storage } from '../storage';
import { InsertTicket } from '@shared/schema';

// Get all tickets for the current user
// Update the getTickets method in zammad-controller.ts
 // Update in zammad-controller.ts - getTickets function

export async function getTickets(req: Request, res: Response) {
  try {
    console.log("GET /api/tickets called");

    // Check if user is authenticated
    if (!req.session.user && !req.session.adUser) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Handle customer users - they should only see their own tickets
    if (req.session.user) {
      const customerEmail = req.session.user.email;
      console.log(`Getting tickets for customer: ${customerEmail}`);
      
      try {
        let tickets = await zammadService.getTicketsByCustomer(customerEmail);
        console.log(`Found ${tickets.length} tickets for customer`);
        return res.json({ tickets });
      } catch (error) {
        console.error(`Error getting tickets for customer ${customerEmail}:`, error);
        return res.status(500).json({ message: "Error retrieving tickets", error: error.message });
      }
    }

    // Handle employee users
    if (req.session.adUser) {
      const employee = req.session.adUser;
      console.log(`Getting tickets for employee: ${employee.username}`);
      
      try {
        // For now, return all tickets for employees (can be filtered based on department later)
        const tickets = await zammadService.getAllTickets();
        console.log(`Found ${tickets.length} tickets total for employee ${employee.username}`);
        return res.json({ tickets });
      } catch (error) {
        console.error(`Error getting tickets for employee ${employee.username}:`, error);
        return res.status(500).json({ message: "Error retrieving tickets", error: error.message });
      }
    }

    return res.status(400).json({ message: "Invalid user session" });
  } catch (error) {
    console.error("Error getting tickets:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
}
// Get a specific ticket by ID
// Update in zammad-controller.ts - getTicketById function

export async function getTicketById(req: Request, res: Response) {
  try {
    const { user, adUser } = req.session as any;
    const { id } = req.params;
    
    if (!user && !adUser) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    console.log(`Getting ticket details for ID: ${id}`);
    
    // Get the ticket from Zammad
    const zammadTicket = await zammadService.getTicket(id);
    
    // Get the ticket articles separately
    const articles = await zammadService.getTicketArticles(id);
    console.log(`Found ${articles?.length || 0} articles for ticket ${id}`);
    
    // Format reply history
    const replyHistory = articles.map(article => ({
      id: article.id,
      from: article.from || 'System',
      body: article.body,
      date: article.created_at,
      internal: article.internal
    }));
    
    // Convert the Zammad ticket to our format
    const ticket = zammadService.mapZammadToTicket(zammadTicket);
    
    // Add the reply history to our ticket
    ticket.replyHistory = replyHistory;
    
    return res.status(200).json({ ticket });
  } catch (error: any) {
    console.error(`Error fetching ticket ${req.params.id} from Zammad:`, error);
    return res.status(500).json({ message: `Failed to fetch ticket: ${error.message}` });
  }
}

export async function createTicket(req: Request, res: Response) {
  try {
    // Make sure user is authenticated
    if (!req.session?.isAuthenticated) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    // Validate the ticket data
    const ticketData = req.body;
    
    try {
      // Determine the authenticated user
      let userEmail, userName, userId;
      
      if (req.session.user) {
        // Local user/customer
        userEmail = req.session.user.email;
        userName = req.session.user.fullName || req.session.user.username;
        userId = req.session.user.id;
      } else if (req.session.adUser) {
        // AD user/employee
        userEmail = req.session.adUser.email || `${req.session.adUser.username}@tecknet.ca`;
        userName = req.session.adUser.fullName || req.session.adUser.username;
        userId = req.session.adUser.id;
      } else {
        return res.status(401).json({ message: 'Invalid user session' });
      }
      
      // For employee-created tickets, make sure we handle customer assignment correctly
      let zammadTicket;
      const isEmployee = !!req.session.adUser;
      
      if (isEmployee) {
        // When an employee creates a ticket:
        // 1. If for a known customer, find/create that customer
        // 2. Otherwise use the employee as both creator and customer
        
        // For simplicity, let's always use the employee as the customer
        // In a real implementation, you might want to add a customer selection field
        zammadTicket = await zammadService.createTicket({
          title: ticketData.subject,
          group_id: parseInt(ticketData.group_id || "1"),
          // For employees, we pass email and name parts separately to avoid the name error
          customer: {
            email: userEmail,
            firstname: userName.split(' ')[0] || '',
            lastname: userName.split(' ').slice(1).join(' ') || ''
          },
          article: {
            subject: ticketData.subject,
            body: ticketData.description,
            type: 'note',
            internal: false
          },
          state_id: zammadService.mapStatusToZammad(ticketData.status),
          priority_id: zammadService.mapPriorityToZammad(ticketData.priority)
        });
      } else {
        // For customers, we need to explicitly format data like we do for employees
        const nameParts = userName.split(' ');
        const firstname = nameParts[0] || '';
        const lastname = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
        
        // Create ticket with explicit group_id
        zammadTicket = await zammadService.createTicket({
          title: ticketData.subject,
          group_id: parseInt(ticketData.group_id || "1"),  // Ensure group_id is included
          customer: {
            email: userEmail,
            firstname: firstname,
            lastname: lastname
          },
          article: {
            subject: ticketData.subject,
            body: ticketData.description,
            type: 'note',
            internal: false
          },
          state_id: zammadService.mapStatusToZammad(ticketData.status),
          priority_id: zammadService.mapPriorityToZammad(ticketData.priority)
        });
      }
      
      // Map back to our format and return
      const ticket = zammadService.mapZammadToTicket(zammadTicket);
      
      return res.status(201).json({ success: true, ticket });
    } catch (zammadError) {
      console.error('Zammad API error:', zammadError);
      
      // Handle API errors
      return res.status(500).json({ 
        message: `Failed to create ticket: ${zammadError.message}`,
        error: zammadError
      });
    }
  } catch (error) {
    console.error('Error in createTicket controller:', error);
    return res.status(500).json({ 
      message: 'Failed to process your request',
      error: error.message
    });
  }
}

// MERGED UPDATE TICKET FUNCTION:
// Update an existing ticket
  // Update the updateTicket function in zammad-controller.ts
export async function updateTicket(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const ticketData = req.body;
    
    // Check if user is authenticated
    if (!req.session.user && !req.session.adUser) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    console.log(`Updating ticket ${id} with data:`, JSON.stringify(ticketData));
    
    // For customer users - verify ticket ownership
    if (req.session.user) {
      const customerEmail = req.session.user.email;
      const tickets = await zammadService.getTicketsByCustomer(customerEmail);
      // Find the ticket with matching ID 
      const userTicket = tickets.find(ticket => {
        // Check against both the internal ID and the Zammad ticket number
        return (
          ticket.id.toString() === id || 
          ticket.number?.toString() === id ||
          ticket.ticketId?.toString() === id
        );
      });
      
      if (!userTicket) {
        console.log(`User ${customerEmail} does not have access to ticket ${id}`);
        return res.status(403).json({ message: "You don't have permission to update this ticket" });
      }
      
      console.log(`Found matching ticket:`, JSON.stringify(userTicket));
      
      // Use the Zammad ticket ID for the update
      const zammadTicketId = userTicket.number || userTicket.id;
      
      // Prepare update data in Zammad format
      const updateData = {
        // Map status to Zammad state_id
        state_id: ticketData.status ? zammadService.mapStatusToZammad(ticketData.status) : undefined,
        // Map priority to Zammad priority_id
        priority_id: ticketData.priority ? zammadService.mapPriorityToZammad(ticketData.priority) : undefined
      };
      
      // Add article (reply) if provided
      if (ticketData.description) {
        updateData.article = {
          body: ticketData.description,
          type: "note",
          internal: false
        };
      }
      
      console.log(`Sending update to Zammad for ticket ${zammadTicketId}:`, JSON.stringify(updateData));
      
      // Update the ticket in Zammad
      const result = await zammadService.updateTicket(zammadTicketId, updateData);
      
      // Return success with updated ticket data
      return res.status(200).json({ 
        success: true, 
        ticket: await zammadService.mapZammadToTicket(result) 
      });
    }
    
    // Handle employee users similarly...
    if (req.session.adUser) {
      // Implement employee update logic here
      // This would be similar but with different permissions
    }
    
    return res.status(400).json({ message: "Invalid request" });
  } catch (error: any) {
    console.error(`Error updating ticket ${req.params.id}:`, error);
    return res.status(500).json({ message: "Error updating ticket: " + error.message });
  }
}

// Create a ticket from the public contact form (no authentication required)
export async function createContactTicket(req: Request, res: Response) {
  try {
    // Extract data from form
    const { name, email, phone, company, subject, message } = req.body;
    
    // Basic validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ 
        message: 'Please provide all required fields: name, email, subject, and message' 
      });
    }
    
    console.log('Creating contact ticket in Zammad:', { email, subject });
    
    // Create ticket in Zammad via the service
    // First, make sure customer exists or create them
    const customerInfo = await zammadService.ensureCustomerExists({
      email,
      name,
      phone,
      organization: company
    });
    
    if (!customerInfo.success) {
      return res.status(500).json({ message: customerInfo.error || 'Failed to create customer' });
    }
    
    // Determine subject category/group
    let groupId = 1; // Default to first group
    
    // Map form subject to appropriate Zammad group_id
    // You may need to adjust these mappings based on your Zammad setup
    if (subject === 'general') {
      groupId = 1; // General Inquiries
    } else if (subject === 'sales') {
      groupId = 2; // Sales
    } else if (subject === 'support') {
      groupId = 3; // Technical Support
    } else if (subject === 'partnership') {
      groupId = 4; // Business Development
    } else if (subject === 'careers') {
      groupId = 5; // HR
    }
    
    // Create the ticket in Zammad
    const zammadTicket = await zammadService.createTicket({
      title: subject === 'general' ? 'General Inquiry' : subject,
      group_id: groupId,
      customer: {
        email: email,
        name: name
      },
      article: {
        subject: subject === 'general' ? 'Website Contact Form' : subject,
        body: message,
        type: "note",
        internal: false
      },
      state_id: zammadService.mapStatusToZammad('open'),
      priority_id: zammadService.mapPriorityToZammad('medium')
    });
    
    // Note: We don't create a local ticket record here since this is from
    // an unauthenticated user and doesn't need to be associated with a user account
    
    console.log('Contact ticket created:', zammadTicket.id, zammadTicket.number);
    
    return res.status(201).json({
      success: true,
      message: 'Your message has been received. Thank you for contacting us!',
      ticketNumber: zammadTicket.number,
      ticketId: zammadTicket.id
    });
  } catch (error) {
    console.error("Error creating contact ticket:", error);
    return res.status(500).json({ 
      success: false,
      message: 'Sorry, we encountered an error while processing your request. Please try again later.'
    });
  }
}