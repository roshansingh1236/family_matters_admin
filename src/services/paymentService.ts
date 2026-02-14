
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

export interface Payment {
  id?: string;
  surrogateId?: string; // Link to specific surrogate
  surrogateName?: string; // Denormalized for easier display or manual entry
  parentId?: string; // NEW - Link to specific parent
  parentName?: string; // NEW - For invoice tracking / display
  childName?: string; // NEW - For invoice tracking
  amount: number;
  type: 'Base Compensation' | 'Allowance' | 'Medical' | 'Travel' | 'Clothing' | 'Legal' | 'Other';
  category: 'Withdrawn' | 'Received'; // NEW - Direction of payment
  status: 'Paid' | 'Pending' | 'Scheduled' | 'Overdue' | 'Cancelled' | 'Rejected'; // UPDATED
  dueDate: string; // YYYY-MM-DD
  paidDate?: string; // YYYY-MM-DD
  description?: string;
  itemDescription?: string; // NEW - Detailed item description for invoices
  notes?: string;
  referenceNumber?: string; // Check # or Transaction ID
  createdAt?: Date;
}

const COLLECTION_NAME = 'payments';

export const paymentService = {
  // Fetch all payments
  getAllPayments: async (): Promise<Payment[]> => {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        orderBy('dueDate', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Payment));
    } catch (error) {
      console.error('Error fetching payments:', error);
      throw error;
    }
  },

  // Create a new payment
  createPayment: async (payment: Omit<Payment, 'id'>): Promise<string> => {
    try {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...payment,
        createdAt: Timestamp.now()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating payment:', error);
      throw error;
    }
  },

  // Update a payment
  updatePayment: async (id: string, updates: Partial<Payment>): Promise<void> => {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, { ...updates });
    } catch (error) {
      console.error('Error updating payment:', error);
      throw error;
    }
  },

  // Delete a payment
  deletePayment: async (id: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (error) {
      console.error('Error deleting payment:', error);
      throw error;
    }
  },

  // Get payments for a specific surrogate
  getPaymentsBySurrogateId: async (surrogateId: string): Promise<Payment[]> => {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('surrogateId', '==', surrogateId),
        orderBy('dueDate', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Payment));
    } catch (error) {
      // Fallback if index is missing
      console.warn('Error fetching surrogate payments (possibly missing index), trying simple fetch', error);
      const qSimple = query(
          collection(db, COLLECTION_NAME), 
          where('surrogateId', '==', surrogateId)
      );
      try {
          const snapshot = await getDocs(qSimple);
          return snapshot.docs
              .map(doc => ({ id: doc.id, ...doc.data() } as Payment))
              .sort((a,b) => b.dueDate.localeCompare(a.dueDate));
      } catch (innerError) {
          // If simple query also fails (rare if single field), return empty or throw
           console.error('Fallback fetch also failed', innerError);
           return [];
      }
    }
  }
};
