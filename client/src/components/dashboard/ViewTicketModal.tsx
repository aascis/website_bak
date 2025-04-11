// Update in ViewTicketModal.tsx
import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Ticket, zammadApi } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ViewTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: Ticket;
}

const ViewTicketModal = ({ isOpen, onClose, ticket }: ViewTicketModalProps) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // State for editable fields
  const [status, setStatus] = useState(ticket?.status || 'open');
  const [priority, setPriority] = useState(ticket?.priority || 'medium');
  const [reply, setReply] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Update state when ticket changes
  useEffect(() => {
    setStatus(ticket?.status || 'open');
    setPriority(ticket?.priority || 'medium');
  }, [ticket]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
      case 'new': // Map Zammad 'new' to 'open'
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-purple-100 text-purple-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low':
        return 'bg-blue-100 text-blue-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'critical':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatStatus = (status: string): string => {
    if (!status) return 'Unknown';
    if (status === 'new') return 'New';
    return status.replace('_', ' ');
  };
  
  const handleUpdateTicket = async () => {
    try {
      setIsSubmitting(true);
      
      // Prepare update data
      const updateData: Partial<Ticket> = {
        status,
        priority
      };
      
      // If there's a reply, include it in the description
      if (reply.trim()) {
        updateData.description = reply;
      }
      
      console.log(`Updating ticket ${ticket.ticketId} with:`, updateData);
      
      // Use the ticketId (Zammad number) for the update instead of internal ID
      await zammadApi.updateZammadTicket(ticket.ticketId, updateData);
      
      // Show success message
      toast({
        title: "Ticket Updated",
        description: "Your ticket has been successfully updated.",
        variant: "default",
      });
      
      // Refresh ticket data
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      
      // Close the modal
      onClose();
    } catch (error) {
      console.error('Error updating ticket:', error);
      toast({
        title: "Update Failed",
        description: "There was a problem updating your ticket. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl">{ticket.subject || 'No Subject'}</DialogTitle>
          <DialogDescription className="flex items-center space-x-2 pt-2">
            <Badge className={getStatusColor(status)}>
              {formatStatus(status)}
            </Badge>
            <Badge className={getPriorityColor(priority)}>
              {priority} priority
            </Badge>
            <span className="text-sm text-gray-500">ID: {ticket.ticketId || 'N/A'}</span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 flex-1 overflow-hidden">
          {/* Full conversation history */}
          <div className="flex-1">
            <h4 className="font-medium text-sm text-gray-500 mb-1">Conversation History</h4>
            <ScrollArea className="h-[240px] rounded-md border">
              <div className="p-4 space-y-4">
                {ticket.description && (
                  <div className="border-b pb-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <div><strong>Original Ticket</strong></div>
                      <div>{new Date(ticket.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="whitespace-pre-line">
                      {ticket.description}
                    </div>
                  </div>
                )}
                
                {/* Show reply history if available */}
                {ticket.replyHistory?.map((reply, index) => (
                  <div key={index} className="border-b pb-3 last:border-b-0">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <div><strong>{reply.from || 'System'}</strong></div>
                      <div>{new Date(reply.date).toLocaleString()}</div>
                    </div>
                    <div className="whitespace-pre-line">
                      {reply.body || 'No content'}
                    </div>
                  </div>
                ))}
                
                {(!ticket.description && (!ticket.replyHistory || ticket.replyHistory.length === 0)) && (
                  <div className="text-gray-500 italic">No conversation history available</div>
                )}
              </div>
            </ScrollArea>
          </div>
          
          {/* Update form */}
          <div className="space-y-3 pt-2 border-t border-gray-200">
            <h4 className="font-medium text-sm text-gray-500">Update Ticket</h4>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Status</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Priority</label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Add Reply</label>
              <Textarea 
                placeholder="Add a reply or update to this ticket..." 
                className="min-h-24"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
              />
            </div>
          </div>
          
          {/* Ticket metadata */}
          {ticket.createdAt && (
            <div className="text-xs text-gray-500">
              Created: {new Date(ticket.createdAt).toLocaleString()}
            </div>
          )}
          
          {ticket.updatedAt && (
            <div className="text-xs text-gray-500">
              Last updated: {new Date(ticket.updatedAt).toLocaleString()}
            </div>
          )}
        </div>
        
        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleUpdateTicket} 
            disabled={isSubmitting}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSubmitting ? 'Updating...' : 'Update Ticket'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ViewTicketModal;