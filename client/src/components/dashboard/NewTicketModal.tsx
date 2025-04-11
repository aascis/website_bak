import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface NewTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

const formSchema = z.object({
    subject: z.string().min(3, 'Subject must be at least 3 characters'),
    description: z.string().min(10, 'Description must be at least 10 characters'),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    group_id: z.string({ required_error: 'Please select a group' }),
  });
  const NewTicketModal = ({ isOpen, onClose, onSubmit }: NewTicketModalProps) => {
    const form = useForm<z.infer<typeof formSchema>>({
      resolver: zodResolver(formSchema),
      defaultValues: {
        subject: '',
        description: '',
        priority: 'medium',
        group_id: '1', // Default to the first group
      },
    });
    const handleSubmit = (data: z.infer<typeof formSchema>) => {
      onSubmit({
        ...data,
        group_id: data.group_id, // Already a string from the form
        // We don't need to handle customer data here, that will be done in the backend
      });
    };
// const formSchema = z.object({
//   subject: z.string().min(3, 'Subject must be at least 3 characters'),
//   description: z.string().min(10, 'Description must be at least 10 characters'),
//   priority: z.enum(['low', 'medium', 'high', 'critical']),
//   group: z.string({ required_error: 'Please select a group' }),
// });

// const NewTicketModal = ({ isOpen, onClose, onSubmit }: NewTicketModalProps) => {
//   const form = useForm<z.infer<typeof formSchema>>({
//     resolver: zodResolver(formSchema),
//     defaultValues: {
//       subject: '',
//       description: '',
//       priority: 'medium',
//       group: '1', // Default to the first group (usually "Users")
//     },
//   });

//   const handleSubmit = (data: z.infer<typeof formSchema>) => {
//     onSubmit({
//       ...data,
//       group_id: parseInt(data.group), // Convert group to number for Zammad
//     });
//   };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Ticket</DialogTitle>
          <DialogDescription>
            Fill out the form below to create a new support ticket.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input placeholder="Brief description of the issue" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Detailed description of the issue"
                      rows={5}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
                <FormField
    control={form.control}
    name="group_id"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Group</FormLabel>
        <Select
          onValueChange={field.onChange}
          defaultValue={field.value}
        >
          <FormControl>
            <SelectTrigger>
              <SelectValue placeholder="Select group" />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            <SelectItem value="1">Users</SelectItem>
            <SelectItem value="2">Support</SelectItem>
            <SelectItem value="3">Sales</SelectItem>
          </SelectContent>
        </Select>
        <FormMessage />
      </FormItem>
    )}
  />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">Create Ticket</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default NewTicketModal;