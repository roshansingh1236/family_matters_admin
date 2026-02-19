
import { supabase } from '../lib/supabase';

export interface Task {
  id?: string;
  title: string;
  description: string;
  assignee: string; // User ID
  assigneeName?: string; // Denormalized for display
  dueDate: string; // YYYY-MM-DD
  isCompleted: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const TABLE_NAME = 'tasks';

export const taskService = {
  // Fetch all tasks
  getAllTasks: async (): Promise<Task[]> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .order('due_date', { ascending: true });
      
      if (error) throw error;
      return (data || []).map(t => ({
          id: t.id,
          title: t.title,
          description: t.description,
          assignee: t.user_id || t.assignee,
          dueDate: t.due_date,
          isCompleted: t.is_completed ?? (t.status === 'Completed'),
          createdAt: t.created_at
      })) as Task[];
    } catch (error) {
      console.error('Error fetching tasks:', error);
      throw error;
    }
  },

  // Create a new task
  createTask: async (task: any): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .insert({
          user_id: task.assignee,
          title: task.title,
          description: task.description,
          due_date: task.dueDate,
          is_completed: task.isCompleted,
          status: task.isCompleted ? 'Completed' : 'Pending'
        })
        .select('id')
        .single();
      
      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  },

  // Update a task
  updateTask: async (id: string, updates: any): Promise<void> => {
    try {
      const mappedUpdates: any = {};
      if (updates.title) mappedUpdates.title = updates.title;
      if (updates.description) mappedUpdates.description = updates.description;
      if (updates.assignee) mappedUpdates.user_id = updates.assignee;
      if (updates.dueDate) mappedUpdates.due_date = updates.dueDate;
      if (updates.isCompleted !== undefined) mappedUpdates.status = updates.isCompleted ? 'Completed' : 'Pending';

      const { error } = await supabase
        .from(TABLE_NAME)
        .update(mappedUpdates)
        .eq('id', id);
        
      if (error) throw error;
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  },

  // Delete a task
  deleteTask: async (id: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from(TABLE_NAME)
        .delete()
        .eq('id', id);
        
      if (error) throw error;
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  },

  // Get tasks by user ID
  getTasksByUserId: async (userId: string): Promise<Task[]> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .eq('user_id', userId)
        .order('due_date', { ascending: true });
      
      if (error) throw error;
      return (data || []).map(t => ({
          id: t.id,
          title: t.title,
          description: t.description,
          assignee: t.user_id,
          dueDate: t.due_date,
          isCompleted: t.is_completed ?? (t.status === 'Completed'),
          createdAt: t.created_at
      })) as Task[];
    } catch (error) {
      console.error('Error fetching tasks by user:', error);
      return [];
    }
  },

  // Get tasks by status
  getTasksByStatus: async (isCompleted: boolean): Promise<Task[]> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .eq('is_completed', isCompleted)
        .order('due_date', { ascending: true });
        
      if (error) throw error;
      return (data || []).map(t => ({
          id: t.id,
          title: t.title,
          description: t.description,
          assignee: t.user_id,
          dueDate: t.due_date,
          isCompleted: t.is_completed ?? (t.status === 'Completed'),
          createdAt: t.created_at
      })) as Task[];
    } catch (error) {
      console.error('Error fetching tasks by status:', error);
      return [];
    }
  }
};

