
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  Timestamp,
  orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export type JourneyStage = 'Matching' | 'Screening' | 'Medical' | 'Legal' | 'Pregnancy' | 'Completed';

export interface StageHistoryEntry {
  stage: JourneyStage;
  completedAt: Date;
  completedBy: string; // Admin ID
  notes?: string;
}

export interface SurrogacyCase {
  id?: string;
  surrogateId: string;
  surrogateName: string;
  parentId: string;
  parentName: string;
  currentStage: JourneyStage;
  stageHistory: StageHistoryEntry[];
  createdAt?: Date;
  updatedAt?: Date;
  notes?: string;
}

const COLLECTION_NAME = 'cases';

const STAGE_ORDER: JourneyStage[] = ['Matching', 'Screening', 'Medical', 'Legal', 'Pregnancy', 'Completed'];

export const milestoneService = {
  // Fetch all cases
  getAllCases: async (): Promise<SurrogacyCase[]> => {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        orderBy('updatedAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
          updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt),
          stageHistory: (data.stageHistory || []).map((entry: any) => ({
            ...entry,
            completedAt: entry.completedAt?.toDate?.() || new Date(entry.completedAt)
          }))
        } as SurrogacyCase;
      });
    } catch (error) {
      console.error('Error fetching cases:', error);
      throw error;
    }
  },

  // Get a specific case
  getCaseById: async (id: string): Promise<SurrogacyCase | null> => {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt),
        stageHistory: (data.stageHistory || []).map((entry: any) => ({
          ...entry,
          completedAt: entry.completedAt?.toDate?.() || new Date(entry.completedAt)
        }))
      } as SurrogacyCase;
    } catch (error) {
      console.error('Error fetching case:', error);
      throw error;
    }
  },

  // Create a new case
  createCase: async (caseData: Omit<SurrogacyCase, 'id' | 'stageHistory'>): Promise<string> => {
    try {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...caseData,
        stageHistory: [],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating case:', error);
      throw error;
    }
  },

  // Update case stage (progress to next stage)
  updateCaseStage: async (
    id: string,
    newStage: JourneyStage,
    adminId: string,
    notes?: string
  ): Promise<void> => {
    try {
      const caseDoc = await milestoneService.getCaseById(id);
      
      if (!caseDoc) {
        throw new Error('Case not found');
      }

      const currentStageIndex = STAGE_ORDER.indexOf(caseDoc.currentStage);
      const newStageIndex = STAGE_ORDER.indexOf(newStage);

      // Validate stage progression
      if (newStageIndex <= currentStageIndex && newStage !== 'Completed') {
        throw new Error('Cannot move to a previous stage');
      }

      // Add current stage to history
      const newHistoryEntry: StageHistoryEntry = {
        stage: caseDoc.currentStage,
        completedAt: new Date(),
        completedBy: adminId,
        notes
      };

      const updatedHistory = [...caseDoc.stageHistory, newHistoryEntry];

      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        currentStage: newStage,
        stageHistory: updatedHistory.map(entry => ({
          ...entry,
          completedAt: Timestamp.fromDate(entry.completedAt)
        })),
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating case stage:', error);
      throw error;
    }
  },

  // Get cases by stage
  getCasesByStage: async (stage: JourneyStage): Promise<SurrogacyCase[]> => {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('currentStage', '==', stage),
        orderBy('updatedAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
          updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt),
          stageHistory: (data.stageHistory || []).map((entry: any) => ({
            ...entry,
            completedAt: entry.completedAt?.toDate?.() || new Date(entry.completedAt)
          }))
        } as SurrogacyCase;
      });
    } catch (error) {
      console.warn('Error fetching cases by stage (possibly missing index), trying simple fetch', error);
      try {
        const allCases = await milestoneService.getAllCases();
        return allCases.filter(c => c.currentStage === stage);
      } catch (innerError) {
        console.error('Fallback fetch also failed', innerError);
        return [];
      }
    }
  },

  // Get next stage in progression
  getNextStage: (currentStage: JourneyStage): JourneyStage | null => {
    const currentIndex = STAGE_ORDER.indexOf(currentStage);
    if (currentIndex === -1 || currentIndex === STAGE_ORDER.length - 1) {
      return null;
    }
    return STAGE_ORDER[currentIndex + 1];
  }
};
