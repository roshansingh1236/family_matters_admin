
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

export interface Appointment {
  id?: string;
  title: string;
  type: 'consultation' | 'medical' | 'legal' | 'psychological' | 'screening' | 'general';
  date: string;
  time: string;
  duration: string;
  participants: string[];
  userIds?: string[];
  userId?: string; // Missing field
  caseId?: string;
  location: string;
  status: 'confirmed' | 'pending' | 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const COLLECTION_NAME = 'appointments';

export const appointmentService = {
  // Fetch all appointments
  getAllAppointments: async (): Promise<Appointment[]> => {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        orderBy('date', 'desc'),
        orderBy('time', 'asc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Appointment));
    } catch (error) {
      console.error('Error fetching appointments:', error);
      throw error;
    }
  },

  // Create a new appointment
  createAppointment: async (appointment: Omit<Appointment, 'id'>): Promise<string> => {
    try {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...appointment,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating appointment:', error);
      throw error;
    }
  },

  // Update an appointment
  updateAppointment: async (id: string, updates: Partial<Appointment>): Promise<void> => {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating appointment:', error);
      throw error;
    }
  },

  // Delete an appointment
  deleteAppointment: async (id: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (error) {
      console.error('Error deleting appointment:', error);
      throw error;
    }
  },

  // Get appointments by type
  getAppointmentsByType: async (type: string): Promise<Appointment[]> => {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('type', '==', type),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Appointment));
    } catch (error) {
      console.error('Error fetching appointments by type:', error);
      throw error;
    }
  }
};
