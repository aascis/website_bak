import fetch from 'node-fetch'; // Using ESM import
import { Ticket } from '@shared/schema';

// Check if environment variables are set
const ZAMMAD_URL = process.env.ZAMMAD_URL;
const ZAMMAD_TOKEN = process.env.ZAMMAD_TOKEN;

class ZammadService {
  private baseUrl: string;
  private apiToken: string;

  // Updated constructor
  constructor() {
    // Check for environment variables and use defaults for development only
    this.baseUrl = 'http://172.24.57.66:8080/api/v1';
    this.apiToken = '35TodJTtbKLpCZfzW3_48FF3pEWh-ZK6mAGHk03s3InL8oh8bkmdc9rGarx0s1Jp';
    
    console.log('Zammad Service initialized with URL:', this.baseUrl);
  }

  // Fixed request method to ensure proper URL construction and error handling
  private async request<T>(path: string, method: string = 'GET', data?: any): Promise<T> {
    try {
      // Ensure path doesn't have leading slash if baseUrl has trailing slash
      if (path.startsWith('/') && this.baseUrl.endsWith('/')) {
        path = path.substring(1);
      }
      
      // Ensure path has leading slash if baseUrl doesn't have trailing slash
      if (!path.startsWith('/') && !this.baseUrl.endsWith('/')) {
        path = '/' + path;
      }
      
      const url = `${this.baseUrl}${path}`;
      console.log(`Making ${method} request to Zammad: ${url}`);
      
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token token=${this.apiToken}`
        }
      };
      
      if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        options.body = JSON.stringify(data);
      }
      
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorJson;
        try {
          errorJson = JSON.parse(errorText);
        } catch (e) {
          errorJson = { error: errorText };
        }
        
        console.error(`Zammad API error for ${url}: ${response.status} ${response.statusText} - ${JSON.stringify(errorJson)}`);
        throw new Error(`Zammad API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorJson)}`);
      }
      
      const result = await response.json();
      return result as T;
    } catch (error) {
      console.error(`Error in Zammad API request to ${this.baseUrl}${path}:`, error);
      throw error;
    }
  }

  private getHeaders() {
    return {
      'Authorization': `Token token=${this.apiToken}`,
      'Content-Type': 'application/json'
    };
  }

  // Updated method to get tickets by agent
  async getTicketsByAgent(agentEmail: string): Promise<any[]> {
    try {
      // Find the agent ID first
      const response = await this.request<any[]>(`users/search?query=${encodeURIComponent(agentEmail)}`);
      
      if (!response || response.length === 0) {
        console.log(`No agent found in Zammad with email: ${agentEmail}`);
        return [];
      }
      
      const agentId = response[0].id;
      console.log(`Found Zammad agent ID ${agentId} for ${agentEmail}`);
      
      // Get tickets assigned to this agent
      const ticketsResponse = await this.request<any[]>(`tickets/search?query=owner.id:${agentId}`);
      return ticketsResponse || [];
    } catch (error) {
      console.error(`Error getting tickets for agent ${agentEmail}:`, error);
      return [];
    }
  }

  // Updated method to get all tickets
  // Add to zammad.ts

async getAllTickets(): Promise<any[]> {
  try {
    console.log('Getting all tickets from Zammad');
    const tickets = await this.request<any[]>('tickets', 'GET');
    
    if (!Array.isArray(tickets)) {
      console.log('Tickets response is not an array:', tickets);
      return [];
    }
    
    console.log(`Retrieved ${tickets.length} tickets from Zammad`);
    
    // Map all tickets to our format
    const mappedTickets = await Promise.all(tickets.map(async ticket => {
      // For each ticket, fetch its articles
      try {
        const articles = await this.getTicketArticles(ticket.id);
        // Add articles to the ticket object
        ticket.articles = articles;
        // Get description from first article if available
        if (articles && articles.length > 0) {
          ticket.description = articles[0].body || 'No description available';
        }
      } catch (err) {
        console.error(`Error fetching articles for ticket ${ticket.id}:`, err);
      }
      
      return this.mapZammadToTicket(ticket);
    }));
    
    return mappedTickets;
  } catch (error) {
    console.error('Error getting all tickets from Zammad:', error);
    return [];
  }
}

  // Updated method to get tickets by customer
    // Update in zammad.ts
async getTicketsByCustomer(email: string): Promise<any[]> {
  try {
    console.log(`Getting tickets for customer email: ${email}`);
    
    // First get the customer ID from Zammad
    const searchUrl = `users/search?query=${encodeURIComponent(email)}`;
    const users = await this.request<any[]>(searchUrl, 'GET');
    
    if (!users || users.length === 0) {
      console.log(`No user found in Zammad with email: ${email}`);
      return [];
    }
    
    const customerId = users[0].id;
    console.log(`Found Zammad user ID ${customerId} for ${email}`);
    
    // Get all tickets
    const allTickets = await this.request<any[]>('tickets', 'GET');
    
    if (!Array.isArray(allTickets)) {
      console.log('Tickets response is not an array:', allTickets);
      return [];
    }
    
    // Filter tickets where customer_id matches
    const customerTickets = allTickets.filter(ticket => ticket.customer_id === customerId);
    console.log(`Found ${customerTickets.length} tickets for customer ID ${customerId}`);
    
    // For each ticket, fetch its articles to get descriptions
    const enrichedTickets = await Promise.all(customerTickets.map(async (ticket) => {
      try {
        // Fetch articles for this ticket
        console.log(`Fetching articles for ticket ${ticket.id}`);
        const articles = await this.request<any[]>(`ticket_articles/by_ticket/${ticket.id}`);
        
        // Get the description from the first article body
        let description = 'No description available';
        if (articles && articles.length > 0) {
          description = articles[0].body || description;
          console.log(`Got description of length ${description.length} for ticket ${ticket.id}`);
        }
        
        // Return ticket with description
        return {
          ...ticket,
          description: description,
          articles: articles || []
        };
      } catch (error) {
        console.error(`Error enriching ticket ${ticket.id}:`, error);
        return ticket;
      }
    }));
    
    // Map to our format
    const mappedTickets = enrichedTickets.map(ticket => this.mapZammadToTicket(ticket));
    console.log('First mapped ticket with description:', 
      mappedTickets.length > 0 ? 
      `ID: ${mappedTickets[0].id}, Description length: ${mappedTickets[0].description?.length || 0}` : 
      'No tickets'
    );
    
    return mappedTickets;
  } catch (error) {
    console.error(`Error getting tickets for customer ${email}:`, error);
    return [];
  }
}

  // Method to get a specific ticket
async getTicket(id: string | number): Promise<any> {
  try {
    console.log(`Getting ticket ${id} from Zammad`);
    const ticket = await this.request<any>(`tickets/${id}`, 'GET');
    
    if (!ticket) {
      throw new Error(`Ticket ${id} not found`);
    }
    
    // Always fetch articles for this ticket
    console.log(`Fetching articles for ticket ${id}`);
    const articles = await this.request<any[]>(`ticket_articles/by_ticket/${id}`, 'GET');
    
    // Add articles to the ticket
    ticket.articles = articles || [];
    
    return ticket;
  } catch (error) {
    console.error(`Error getting ticket ${id} from Zammad:`, error);
    throw error;
  }
}

  // Method to get ticket articles (descriptions)
  async getTicketArticles(ticketId: string | number): Promise<any[]> {
    try {
      console.log(`Fetching articles for ticket ${ticketId}`);
      const articles = await this.request<any[]>(`ticket_articles/by_ticket/${ticketId}`);
      console.log(`Found ${articles?.length || 0} articles for ticket ${ticketId}`);
      if (articles && articles.length > 0) {
        console.log('First article body sample:', articles[0].body?.substring(0, 100));
      }
      return articles || [];
    } catch (error) {
      console.error(`Error getting articles for ticket ${ticketId}:`, error);
      return [];
    }
  }

  // Helper method to enrich a ticket with its articles
  async enrichTicketWithArticles(ticket: any): Promise<any> {
    try {
      const articles = await this.getTicketArticles(ticket.id);
      return {
        ...ticket,
        articles: articles || []
      };
    } catch (error) {
      console.error(`Error enriching ticket ${ticket.id} with articles:`, error);
      return ticket;
    }
  }

  // Method to create a ticket in Zammad
  async createTicket(ticketData: any): Promise<any> {
    try {
      // Basic validation
      if (!this.apiToken || !this.baseUrl) {
        const error = new Error('Zammad service not configured');
        console.error(error);
        throw error;
      }
      
      console.log('Creating ticket in Zammad with data:', JSON.stringify(ticketData));
      
      // Make sure all required fields are present
      if (!ticketData.title) {
        throw new Error('Missing required field: title');
      }
      if (!ticketData.group_id) {
        throw new Error('Missing required field: group_id');
      }
      
      // Check for customer information
      if (!ticketData.customer && !ticketData.customer_id) {
        throw new Error('Missing required field: customer or customer_id');
      }
      
      if (!ticketData.article || !ticketData.article.subject || !ticketData.article.body) {
        throw new Error('Missing required field: article with subject and body');
      }
      
      // Define request data
      let requestData: any = {
        title: ticketData.title,
        group_id: ticketData.group_id,
        state_id: ticketData.state_id || 1, // Default to 'new'
        priority_id: ticketData.priority_id || 2, // Default to 'normal'
      };
      
      // Handle customer assignment correctly
      if (ticketData.customer_id) {
        requestData.customer_id = ticketData.customer_id;
      } else if (ticketData.customer) {
        // Customer is an object with user details
        requestData.customer = ticketData.customer;
      }
      
      // Include article
      requestData.article = ticketData.article;
      
      // Send to Zammad API
      const result = await this.request<any>('tickets', 'POST', requestData);
      
      console.log('Ticket created in Zammad:', result);
      return result;
    } catch (error) {
      console.error('Failed to create ticket in Zammad:', error);
      throw error;
    }
  }

  // Method to update a ticket in Zammad
  // Update in zammad.ts
async updateTicket(ticketId: string | number, ticketData: any): Promise<any> {
  try {
    console.log(`Updating ticket ${ticketId} with data:`, JSON.stringify(ticketData));
    
    // First, get the current ticket to verify it exists
    const currentTicket = await this.getTicket(ticketId);
    if (!currentTicket) {
      throw new Error(`Ticket ${ticketId} not found`);
    }
    
    // Prepare the update data in Zammad format
    const updateData: any = {};
    
    // Map status to state name (not state_id)
    if (ticketData.status) {
      // Zammad uses slightly different status names
      switch (ticketData.status) {
        case 'open': updateData.state = 'new'; break;
        case 'in_progress': updateData.state = 'open'; break;
        case 'pending': updateData.state = 'pending reminder'; break;
        case 'resolved': updateData.state = 'solved'; break;
        case 'closed': updateData.state = 'closed'; break;
        default: updateData.state = 'open';
      }
      console.log(`Mapped status ${ticketData.status} to Zammad state "${updateData.state}"`);
    }
    
    // Map priority to Zammad priority name (not priority_id)
    if (ticketData.priority) {
      updateData.priority = ticketData.priority;
      console.log(`Using priority "${updateData.priority}" for Zammad ticket`);
    }
    
    // Update the ticket first
    const updateTicketResult = await this.request<any>(`tickets/${ticketId}`, 'PUT', updateData);
    console.log(`Ticket ${ticketId} base properties updated in Zammad`);
    
    // If description is provided, create a new article in a separate request
    if (ticketData.description && ticketData.description.trim()) {
      const articleData = {
        ticket_id: ticketId,
        subject: 'Ticket Update',
        body: ticketData.description.trim(),
        content_type: 'text/plain',
        type: 'note',
        internal: false
      };
      
      console.log(`Adding new article to ticket ${ticketId}:`, JSON.stringify(articleData));
      const articleResult = await this.request<any>('ticket_articles', 'POST', articleData);
      console.log(`Added new article ${articleResult.id} to ticket ${ticketId}`);
    }
    
    // Fetch the updated ticket to return
    const updatedTicket = await this.getTicket(ticketId);
    return updatedTicket;
  } catch (error) {
    console.error(`Error updating ticket ${ticketId} in Zammad:`, error);
    throw error;
  }
}


  // Method to find or create a customer in Zammad
  async findOrCreateCustomer(userData: {
    email: string;
    name: string;
  }): Promise<any> {
    try {
      // Search for the customer
      const searchResult = await this.request<any[]>(`users/search?query=${encodeURIComponent(userData.email)}`);
      
      if (searchResult && searchResult.length > 0) {
        return searchResult[0]; // Customer exists
      }
      
      // Create a new customer
      const newCustomer = await this.request<any>('users', 'POST', {
        email: userData.email,
        firstname: userData.name.split(' ')[0] || '',
        lastname: userData.name.split(' ').slice(1).join(' ') || '',
        role_ids: [3] // Customer role in Zammad
      });
      
      return newCustomer;
    } catch (error) {
      console.error(`Error finding or creating customer ${userData.email}:`, error);
      throw error;
    }
  }
  
  // Method to map our ticket format to Zammad format
   // Update in zammad.ts
    // Update in zammad.ts
mapZammadToTicket(zammadTicket: any): Partial<Ticket> {
  if (!zammadTicket) {
    return {};
  }
  
  // Extract all articles for conversation history
  const articles = zammadTicket.articles || [];
  console.log(`Ticket ${zammadTicket.id} has ${articles.length} articles`);
  
  // Sort articles by created_at date to maintain chronological order
  articles.sort((a: any, b: any) => {
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
  
  // Format article bodies into conversation history
  let description = 'No description available';
  let conversationHistory = '';
  
  if (articles.length > 0) {
    // Get first article as main description
    description = articles[0].body || description;
    
    // Combine all articles into conversation history
    conversationHistory = articles.map((article: any) => {
      const date = new Date(article.created_at).toLocaleString();
      const from = article.from || 'System';
      return `[${date}] ${from}:\n${article.body}\n`;
    }).join('\n---\n\n');
  }
  
  console.log(`Mapped ticket ${zammadTicket.id}, with conversation history of length: ${conversationHistory.length}`);
  
  // Determine status and priority (existing code)
  let status: string;
  switch (zammadTicket.state_id) {
    case 1: status = 'open'; break;
    case 2: status = 'in_progress'; break;  
    case 3: status = 'pending'; break;
    case 4: case 6: case 7: status = 'closed'; break;
    default: status = 'open';
  }
  
  let priority: string;
  switch (zammadTicket.priority_id) {
    case 1: priority = 'low'; break;
    case 2: priority = 'medium'; break;
    case 3: priority = 'high'; break;
    case 4: priority = 'critical'; break;
    default: priority = 'medium';
  }
  
  const mappedTicket = {
    id: zammadTicket.id,
    ticketId: zammadTicket.number?.toString() || zammadTicket.id?.toString() || 'N/A',
    subject: zammadTicket.title || 'No Subject',
    description: description, // Keep original description (first article)
    conversationHistory: conversationHistory, // Add full conversation history
    status: status,
    priority: priority,
    createdAt: zammadTicket.created_at ? new Date(zammadTicket.created_at) : new Date(),
    updatedAt: zammadTicket.updated_at ? new Date(zammadTicket.updated_at) : new Date(),
    lastUpdated: zammadTicket.updated_at ? new Date(zammadTicket.updated_at) : new Date(),
    articles: articles // Save all articles for reference
  };
  
  return mappedTicket;
}

  // Method to map our status to Zammad status ID
  public mapStatusToZammad(status?: string): number {
    switch (status) {
      case 'open':
        return 1; // 'new' in Zammad
      case 'in_progress':
        return 2; // 'open' in Zammad
      case 'pending':
        return 3; // 'pending reminder' in Zammad
      case 'resolved':
        return 4; // 'closed' in Zammad
      case 'closed':
        return 6; // 'closed successful' in Zammad
      default:
        return 1; // Default to 'new'
    }
  }
  
  // Method to map our priority to Zammad priority ID
  public mapPriorityToZammad(priority?: string): number {
    switch (priority) {
      case 'low':
        return 1; // 'low' in Zammad
      case 'medium':
        return 2; // 'normal' in Zammad
      case 'high':
        return 3; // 'high' in Zammad
      case 'critical':
        return 4; // 'very high' in Zammad
      default:
        return 2; // Default to 'normal'
    }
  }
  
  // Method to map Zammad ticket to our format with descriptions
  async mapZammadToTicketWithArticles(zammadTicket: any): Promise<Partial<Ticket>> {
    if (!zammadTicket) {
      return {};
    }
    
    // Fetch the ticket articles to get the full description
    let description = 'No description available';
    try {
      const articles = await this.getTicketArticles(zammadTicket.id);
      if (articles && articles.length > 0) {
        description = articles[0].body || description;
      }
    } catch (error) {
      console.error(`Error fetching articles for ticket ${zammadTicket.id}:`, error);
    }
    
    // Map other properties...
    return {
      id: zammadTicket.id,
      ticketId: zammadTicket.number?.toString() || zammadTicket.id?.toString() || 'N/A',
      subject: zammadTicket.title || 'No Subject',
      description: description,
      status: this.mapZammadStatusToInternal(zammadTicket.state_id),
      priority: this.mapZammadPriorityToInternal(zammadTicket.priority_id),
      createdAt: zammadTicket.created_at ? new Date(zammadTicket.created_at) : new Date(),
      updatedAt: zammadTicket.updated_at ? new Date(zammadTicket.updated_at) : new Date(),
      lastUpdated: zammadTicket.updated_at ? new Date(zammadTicket.updated_at) : new Date()
    };
  }
  
  // Simpler method to map Zammad ticket to our format
  mapZammadToTicket(zammadTicket: any): Partial<Ticket> {
    if (!zammadTicket) {
      return {};
    }
    
    // Check if this ticket already has articles attached
    let description = '';
    if (zammadTicket.articles && zammadTicket.articles.length > 0) {
      description = zammadTicket.articles[0].body || '';
    }
    
    return {
      id: zammadTicket.id,
      ticketId: zammadTicket.number || zammadTicket.id.toString(),
      subject: zammadTicket.title,
      description: description || zammadTicket.note || 'No description available',
      status: this.mapZammadStatusToInternal(zammadTicket.state_id),
      priority: this.mapZammadPriorityToInternal(zammadTicket.priority_id),
      createdAt: new Date(zammadTicket.created_at),
      updatedAt: new Date(zammadTicket.updated_at),
      lastUpdated: new Date(zammadTicket.updated_at),
      userId: null,
      adUserId: null,
      assignedTo: zammadTicket.owner_id
    };
  }
  
  // Helper method to extract ticket description from Zammad ticket
  private getTicketDescription(zammadTicket: any): string {
    // Check if this ticket has articles
    if (zammadTicket.articles && zammadTicket.articles.length > 0) {
      return zammadTicket.articles[0].body || '';
    }
    
    // Try to get the first article body
    if (zammadTicket.article_count > 0) {
      return `This ticket has ${zammadTicket.article_count} message(s). View details to see the full content.`;
    }
    
    // Fallback to an empty string
    return zammadTicket.note || '';
  }
  
  // Method to map Zammad status ID to our status
  private mapZammadStatusToInternal(stateId: number): 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed' {
    switch (stateId) {
      case 1: // 'new' in Zammad
        return 'open';
      case 2: // 'open' in Zammad
        return 'in_progress';
      case 3: // 'pending reminder' in Zammad
      case 5: // 'pending close' in Zammad
        return 'pending';
      case 4: // 'closed' in Zammad
      case 6: // 'closed successful' in Zammad
      case 7: // 'closed unsuccessful' in Zammad
        return 'closed';
      default:
        return 'open';
    }
  }
  
  // Method to map Zammad priority ID to our priority
  private mapZammadPriorityToInternal(priorityId: number): 'low' | 'medium' | 'high' | 'critical' {
    switch (priorityId) {
      case 1: // 'low' in Zammad
        return 'low';
      case 2: // 'normal' in Zammad
        return 'medium';
      case 3: // 'high' in Zammad
        return 'high';
      case 4: // 'very high' in Zammad
        return 'critical';
      default:
        return 'medium';
    }
  }

  // Method to ensure customer exists in Zammad
  async ensureCustomerExists(customerData: { email: string, name: string, phone?: string, organization?: string }): Promise<{ success: boolean, customerId?: number, error?: string }> {
    try {
      const { email, name, phone, organization } = customerData;
      
      // First search for customer by email
      const searchUrl = `users/search?query=${encodeURIComponent(email)}`;
      const searchResults = await this.request<any[]>(searchUrl, 'GET');
      
      // If customer exists, return their ID
      if (searchResults && searchResults.length > 0) {
        return {
          success: true,
          customerId: searchResults[0].id
        };
      }
      
      // Customer doesn't exist, create a new one
      // Parse name into first and last name
      const nameParts = name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
      
      const newCustomer = await this.request<any>('users', 'POST', {
        firstname: firstName,
        lastname: lastName,
        email: email,
        phone: phone || '',
        organization: organization || '',
        roles: ['Customer']
      });
      
      return {
        success: true,
        customerId: newCustomer.id
      };
    } catch (error) {
      console.error('Error in ensureCustomerExists:', error);
      return {
        success: false,
        error: error.message || 'Failed to create or find customer'
      };
    }
  }
}

export const zammadService = new ZammadService();