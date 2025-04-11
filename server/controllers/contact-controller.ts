import { Request, Response } from 'express';
import { zammadService } from '../services/zammad';

// export async function createContactTicket(req: Request, res: Response) {
//   try {
//     // Check if Zammad is configured
//     if (!process.env.ZAMMAD_URL || !process.env.ZAMMAD_TOKEN) {
//       console.warn('Zammad not configured. Contact form submission could not be processed.');
//       return res.status(503).json({ 
//         message: 'Our messaging system is currently unavailable. Please try again later.',
//         configIssue: true
//       });
//     }
    
//     const formData = req.body;
    
//     // Validation - ensure required fields are present
//     if (!formData.name || !formData.email || !formData.message || !formData.subject) {
//       return res.status(400).json({ 
//         message: 'Missing required fields for contact submission.',
//         success: false
//       });
//     }
    
//     // Format the subject based on the dropdown selection
//     const formattedSubject = formData.subject === 'general' ? 'General Inquiry' : 
//                            formData.subject === 'sales' ? 'Sales Question' : 
//                            formData.subject === 'support' ? 'Technical Support' : 
//                            formData.subject === 'partnership' ? 'Partnership Opportunity' : 
//                            'Careers';
    
//     // Map group ID based on subject
//     const groupId = formData.subject === 'sales' ? 3 : // Sales team 
//                   formData.subject === 'careers' ? 2 : // HR team
//                   formData.subject === 'partnership' ? 3 : // Sales team
//                   formData.subject === 'support' ? 1 : // Support team
//                   1; // Default to support for general inquiries
    
//     try {
//       // Format ticket data for Zammad
//       const ticketData = {
//         title: `${formattedSubject}: ${formData.name}`,
//         group_id: groupId,
//         // Special case: for contact form, use our dedicated customer account
//         customer_id: 'contact@tecknet.ca', // Use email for Zammad API
//         article: {
//           subject: `Website Contact Form: ${formData.name}`,
//           body: `
// Name: ${formData.name}
// Email: ${formData.email}
// Phone: ${formData.phone || 'Not provided'}
// ${formData.company ? `Company: ${formData.company}` : ''}

// Subject: ${formattedSubject}

// Message:
// ${formData.message}

// Source: Website Contact Form
// ${formData.from ? `Form Type: ${formData.from}` : ''}
// ${formData.source ? `Source: ${formData.source}` : ''}
//           `,
//           type: 'note',
//           internal: false,
//           content_type: 'text/plain'
//         }
//       };
      
//       // Create the ticket in Zammad
//       const zammadTicket = await zammadService.createTicket(ticketData);
      
//       console.log(`Contact form ticket created: #${zammadTicket.number || zammadTicket.id}`);
      
//       return res.status(201).json({ 
//         success: true, 
//         message: 'Your message has been received. Our team will contact you shortly.',
//         ticketId: zammadTicket.number || zammadTicket.id
//       });
//     } catch (zammadError) {
//       console.error('Zammad API error when creating contact form ticket:', zammadError);
      
//       // Check if it's a configuration issue or network error
//       if (zammadError.message?.includes('not configured') || 
//           zammadError.message?.includes('ENOTFOUND') ||
//           zammadError.message?.includes('ECONNREFUSED')) {
//         return res.status(503).json({ 
//           message: 'Our messaging system is currently unavailable. Please try again later.',
//           configIssue: true
//         });
//       }
      
//       // For other API errors
//       return res.status(500).json({ 
//         message: 'We could not process your message at this time. Please try again later.',
//         error: 'Ticket system communication failure'
//       });
//     }
//   } catch (error) {
//     console.error('Error processing contact form submission:', error);
//     return res.status(500).json({ 
//       message: 'An error occurred while processing your request. Please try again later.',
//       error: 'Internal server error'
//     });
//   }
// }

// Modified contact-controller.ts (just the key part that's causing the error)
export async function createContactTicket(req: Request, res: Response) {
    try {
      // Check if Zammad is configured
      if (!process.env.ZAMMAD_URL || !process.env.ZAMMAD_TOKEN) {
        console.warn('Zammad not configured. Contact form submission could not be processed.');
        return res.status(503).json({ 
          message: 'Our messaging system is currently unavailable. Please try again later.',
          configIssue: true
        });
      }
      
      const formData = req.body;
      
      // Validation - ensure required fields are present
      if (!formData.name || !formData.email || !formData.message || !formData.subject) {
        return res.status(400).json({ 
          message: 'Missing required fields for contact submission.',
          success: false
        });
      }
      
      // Format the subject based on the dropdown selection
      const formattedSubject = formData.subject === 'general' ? 'General Inquiry' : 
                             formData.subject === 'sales' ? 'Sales Question' : 
                             formData.subject === 'support' ? 'Technical Support' : 
                             formData.subject === 'partnership' ? 'Partnership Opportunity' : 
                             'Careers';
      
      // Map group ID based on subject
      const groupId = formData.subject === 'sales' ? 3 : // Sales team 
                    formData.subject === 'careers' ? 2 : // HR team
                    formData.subject === 'partnership' ? 3 : // Sales team
                    formData.subject === 'support' ? 1 : // Support team
                    1; // Default to support for general inquiries
      
      try {
        // Look up the contact user by email (should be pre-created)
        const contactEmail = 'contact@tecknet.ca';
        
        // Format ticket data for Zammad API
        const ticketData = {
          title: `${formattedSubject}: ${formData.name}`,
          group_id: groupId,
          customer: {
            email: contactEmail,
            // We need to provide these fields separately
            firstname: "Contact",
            lastname: "Form"
          },
          article: {
            subject: `Website Contact Form: ${formData.name}`,
            body: `
  Name: ${formData.name}
  Email: ${formData.email}
  Phone: ${formData.phone || 'Not provided'}
  ${formData.company ? `Company: ${formData.company}` : ''}
  
  Subject: ${formattedSubject}
  
  Message:
  ${formData.message}
  
  Source: Website Contact Form
  ${formData.from ? `Form Type: ${formData.from}` : ''}
  ${formData.source ? `Source: ${formData.source}` : ''}
            `,
            type: 'note',
            internal: false,
            content_type: 'text/plain'
          },
          state_id: 1, // new
          priority_id: 2 // normal
        };
        
        // Create the ticket directly through the Zammad service
        const zammadTicket = await zammadService.createTicket(ticketData);
        
        console.log(`Contact form ticket created: #${zammadTicket.number || zammadTicket.id}`);
        
        return res.status(201).json({ 
          success: true, 
          message: 'Your message has been received. Our team will contact you shortly.',
          ticketId: zammadTicket.number || zammadTicket.id
        });
      } catch (zammadError) {
        console.error('Zammad API error when creating contact form ticket:', zammadError);
        
        // Check if it's a configuration issue or network error
        if (zammadError.message?.includes('not configured') || 
            zammadError.message?.includes('ENOTFOUND') ||
            zammadError.message?.includes('ECONNREFUSED')) {
          return res.status(503).json({ 
            message: 'Our messaging system is currently unavailable. Please try again later.',
            configIssue: true
          });
        }
        
        // For other API errors
        return res.status(500).json({ 
          message: 'We could not process your message at this time. Please try again later.',
          error: 'Ticket system communication failure'
        });
      }
    } catch (error) {
      console.error('Error processing contact form submission:', error);
      return res.status(500).json({ 
        message: 'An error occurred while processing your request. Please try again later.',
        error: 'Internal server error'
      });
    }
  }