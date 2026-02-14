
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  query, 
  where, 
  Timestamp,
  orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface Task {
  id?: string;
  title: string;
  description: string;
  assignee: string; // User ID
  assigneeName?: string; // Denormalized for display
  dueDate: string; // YYYY-MM-DD
  isCompleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const COLLECTION_NAME = 'tasks';

export const taskService = {
  // Fetch all tasks
  getAllTasks: async (): Promise<Task[]> => {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        orderBy('dueDate', 'asc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Task));
    } catch (error) {
      console.error('Error fetching tasks:', error);
      throw error;
    }
  },

  // Create a new task
  createTask: async (task: Omit<Task, 'id'>): Promise<string> => {
    try {
      console.log('Creating new task:', {
        title: task.title,
        assignee: task.assignee,
        assigneeName: task.assigneeName,
        dueDate: task.dueDate,
        isCompleted: task.isCompleted
      });
      
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...task,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      
      console.log('Task created successfully with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  },

  // Update a task
  updateTask: async (id: string, updates: Partial<Task>): Promise<void> => {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  },

  // Delete a task
  deleteTask: async (id: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  },

  // Get tasks by user ID
  getTasksByUserId: async (userId: string): Promise<Task[]> => {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('assignee', '==', userId),
        orderBy('dueDate', 'asc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Task));
    } catch (error) {
      console.warn('Error fetching tasks by user (possibly missing index), trying simple fetch', error);
      try {
        const qSimple = query(collection(db, COLLECTION_NAME));
        const snapshot = await getDocs(qSimple);
        return snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Task))
          .filter(t => t.assignee === userId)
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      } catch (innerError) {
        console.error('Fallback fetch also failed', innerError);
        return [];
      }
    }
  },

  // Get tasks by status
  getTasksByStatus: async (isCompleted: boolean): Promise<Task[]> => {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('isCompleted', '==', isCompleted),
        orderBy('dueDate', 'asc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Task));
    } catch (error) {
      console.warn('Error fetching tasks by status (possibly missing index), trying simple fetch', error);
      try {
        const qSimple = query(collection(db, COLLECTION_NAME));
        const snapshot = await getDocs(qSimple);
        return snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Task))
          .filter(t => t.isCompleted === isCompleted)
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      } catch (innerError) {
        console.error('Fallback fetch also failed', innerError);
        return [];
      }
    }
  }
};
