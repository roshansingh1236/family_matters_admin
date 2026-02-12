
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
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../lib/firebase';

export interface BabyWatchUpdate {
  id?: string;
  caseId: string; // Link to specific journey
  date: string; // YYYY-MM-DD for easier display
  gestationalAge: string; // e.g., "12 Weeks"
  weight?: string;
  heartRate?: string;
  medicalNotes: string;
  imageUrl?: string; // Firebase Storage URL
  imagePath?: string; // Storage path for deletion
  sharedWithParents: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const COLLECTION_NAME = 'baby_watch';

export const babyWatchService = {
  // Fetch all updates
  getAllUpdates: async (): Promise<BabyWatchUpdate[]> => {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as BabyWatchUpdate));
    } catch (error) {
      console.error('Error fetching baby watch updates:', error);
      throw error;
    }
  },

  // Upload image to Firebase Storage
  uploadImage: async (file: File, caseId: string): Promise<{ url: string; path: string }> => {
    try {
      const timestamp = Date.now();
      const fileName = `${caseId}_${timestamp}_${file.name}`;
      const storageRef = ref(storage, `baby_watch/${fileName}`);
      
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      return { url, path: `baby_watch/${fileName}` };
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  },

  // Create a new update
  createUpdate: async (update: Omit<BabyWatchUpdate, 'id'>, imageFile?: File): Promise<string> => {
    try {
      let imageUrl = update.imageUrl;
      let imagePath = update.imagePath;

      // Upload image if provided
      if (imageFile) {
        const { url, path } = await babyWatchService.uploadImage(imageFile, update.caseId);
        imageUrl = url;
        imagePath = path;
      }

      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...update,
        imageUrl,
        imagePath,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating baby watch update:', error);
      throw error;
    }
  },

  // Update an update
  updateUpdate: async (id: string, updates: Partial<BabyWatchUpdate>, imageFile?: File): Promise<void> => {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      
      let updateData: any = {
        ...updates,
        updatedAt: Timestamp.now()
      };

      // Upload new image if provided
      if (imageFile && updates.caseId) {
        const { url, path } = await babyWatchService.uploadImage(imageFile, updates.caseId);
        updateData.imageUrl = url;
        updateData.imagePath = path;
      }

      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating baby watch update:', error);
      throw error;
    }
  },

  // Delete an update
  deleteUpdate: async (id: string, imagePath?: string): Promise<void> => {
    try {
      // Delete image from storage if exists
      if (imagePath) {
        try {
          const imageRef = ref(storage, imagePath);
          await deleteObject(imageRef);
        } catch (error) {
          console.warn('Error deleting image from storage:', error);
          // Continue with document deletion even if image deletion fails
        }
      }

      await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (error) {
      console.error('Error deleting baby watch update:', error);
      throw error;
    }
  },

  // Get updates by case ID
  getUpdatesByCaseId: async (caseId: string): Promise<BabyWatchUpdate[]> => {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('caseId', '==', caseId),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as BabyWatchUpdate));
    } catch (error) {
      console.warn('Error fetching updates by case (possibly missing index), trying simple fetch', error);
      try {
        const qSimple = query(collection(db, COLLECTION_NAME));
        const snapshot = await getDocs(qSimple);
        return snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as BabyWatchUpdate))
          .filter(u => u.caseId === caseId)
          .sort((a, b) => b.date.localeCompare(a.date));
      } catch (innerError) {
        console.error('Fallback fetch also failed', innerError);
        return [];
      }
    }
  }
};
