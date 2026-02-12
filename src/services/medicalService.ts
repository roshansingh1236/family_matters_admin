
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

export interface MedicalRecord {
  id?: string;
  surrogateId?: string; // Link to specific surrogate (optional if global, but good for filtering)
  patientName: string; 
  userId?: string; // Explicit link to user ID
  date: string; // YYYY-MM-DD
  type: 'Screening' | 'Ultrasound' | 'Lab Result' | 'Check-up' | 'Procedure' | 'Other';
  title: string;
  summary: string;
  provider: string; // Doctor/Clinic Name
  status: 'Verified' | 'Pending' | 'Flagged';
  sharedWithParents: boolean;
  attachments?: string[]; // URLs
  createdAt?: Date;
}

export interface Medication {
  id?: string;
  surrogateId?: string;
  userId?: string;
  name: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate?: string;
  status: 'Active' | 'Completed' | 'Discontinued';
  notes?: string;
}

const RECORDS_COLLECTION = 'medical_records';
const MEDS_COLLECTION = 'medications';

export const medicalService = {
  // --- Medical Records ---

  getAllRecords: async (): Promise<MedicalRecord[]> => {
    try {
      const q = query(
        collection(db, RECORDS_COLLECTION),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as MedicalRecord));
    } catch (error) {
      console.error('Error fetching medical records:', error);
      throw error;
    }
  },

  createRecord: async (record: Omit<MedicalRecord, 'id'>): Promise<string> => {
    try {
      const docRef = await addDoc(collection(db, RECORDS_COLLECTION), {
        ...record,
        createdAt: Timestamp.now()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating medical record:', error);
      throw error;
    }
  },

  updateRecord: async (id: string, updates: Partial<MedicalRecord>): Promise<void> => {
    try {
      const docRef = doc(db, RECORDS_COLLECTION, id);
      await updateDoc(docRef, { ...updates });
    } catch (error) {
      console.error('Error updating medical record:', error);
      throw error;
    }
  },

  deleteRecord: async (id: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, RECORDS_COLLECTION, id));
    } catch (error) {
      console.error('Error deleting medical record:', error);
      throw error;
    }
  },

  // --- Medications ---

  getAllMedications: async (): Promise<Medication[]> => {
    try {
      const q = query(
        collection(db, MEDS_COLLECTION),
        orderBy('startDate', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Medication));
    } catch (error) {
      console.error('Error fetching medications:', error);
      throw error;
    }
  },

  createMedication: async (medication: Omit<Medication, 'id'>): Promise<string> => {
    try {
      const docRef = await addDoc(collection(db, MEDS_COLLECTION), {
        ...medication
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating medication:', error);
      throw error;
    }
  },

  updateMedication: async (id: string, updates: Partial<Medication>): Promise<void> => {
    try {
      const docRef = doc(db, MEDS_COLLECTION, id);
      await updateDoc(docRef, { ...updates });
    } catch (error) {
      console.error('Error updating medication:', error);
      throw error;
    }
  },

  deleteMedication: async (id: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, MEDS_COLLECTION, id));
    } catch (error) {
      console.error('Error deleting medication:', error);
      throw error;
    }
  },

  // --- Surrogate Specific ---

  getRecordsBySurrogateId: async (surrogateId: string): Promise<MedicalRecord[]> => {
    try {
      const q = query(
        collection(db, RECORDS_COLLECTION),
        where('userId', '==', surrogateId),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as MedicalRecord));
    } catch (error) {
      // Fallback if index is missing or query fails, try client-side filtering or just recent
      console.warn('Error fetching surrogate records (possibly missing index), trying simple fetch', error);
      try {
        const qSimple = query(collection(db, RECORDS_COLLECTION)); 
        const snapshot = await getDocs(qSimple);
        return snapshot.docs
               .map(doc => ({ id: doc.id, ...doc.data() } as MedicalRecord))
               .filter(r => r.userId === surrogateId || r.surrogateId === surrogateId)
               .sort((a,b) => b.date.localeCompare(a.date));
      } catch (innerError) {
         console.error('Fallback fetch also failed', innerError);
         return [];
      }
    }
  },

  getMedicationsBySurrogateId: async (surrogateId: string): Promise<Medication[]> => {
    try {
      // Simple query first
      const q = query(
        collection(db, MEDS_COLLECTION),
        where('userId', '==', surrogateId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Medication));
    } catch (error) {
      console.error('Error fetching surrogate medications:', error);
      // Fallback
       console.warn('Error fetching surrogate medications (possibly missing index), trying simple fetch', error);
      try {
        const qSimple = query(collection(db, MEDS_COLLECTION)); 
        const snapshot = await getDocs(qSimple);
        return snapshot.docs
               .map(doc => ({ id: doc.id, ...doc.data() } as Medication))
               .filter(r => r.userId === surrogateId || r.surrogateId === surrogateId);
      } catch (innerError) {
         console.error('Fallback fetch also failed', innerError);
         return [];
      }
    }
  }
};
