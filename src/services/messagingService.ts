
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

export interface Conversation {
  id?: string;
  participants: string[]; // User IDs including admin
  participantNames: Record<string, string>; // ID -> Name mapping
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: Record<string, number>; // User ID -> unread count
  createdAt?: Date;
}

export interface Message {
  id?: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: Date;
  read: boolean;
}

const CONVERSATIONS_COLLECTION = 'conversations';
const MESSAGES_SUBCOLLECTION = 'messages';

export const messagingService = {
  // Get all conversations where admin is a participant
  getConversations: async (adminId: string): Promise<Conversation[]> => {
    try {
      const q = query(
        collection(db, CONVERSATIONS_COLLECTION),
        where('participants', 'array-contains', adminId),
        orderBy('lastMessageTime', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        lastMessageTime: doc.data().lastMessageTime?.toDate?.() || new Date(doc.data().lastMessageTime)
      } as Conversation));
    } catch (error) {
      console.error('Error fetching conversations:', error);
      throw error;
    }
  },

  // Get a specific conversation with its messages
  getConversationById: async (conversationId: string): Promise<{ conversation: Conversation; messages: Message[] }> => {
    try {
      const conversationDoc = await getDoc(doc(db, CONVERSATIONS_COLLECTION, conversationId));
      
      if (!conversationDoc.exists()) {
        throw new Error('Conversation not found');
      }

      const conversation = {
        id: conversationDoc.id,
        ...conversationDoc.data(),
        lastMessageTime: conversationDoc.data().lastMessageTime?.toDate?.() || new Date(conversationDoc.data().lastMessageTime)
      } as Conversation;

      // Fetch messages
      const messagesQuery = query(
        collection(db, CONVERSATIONS_COLLECTION, conversationId, MESSAGES_SUBCOLLECTION),
        orderBy('timestamp', 'asc')
      );
      const messagesSnapshot = await getDocs(messagesQuery);
      const messages = messagesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.() || new Date(doc.data().timestamp)
      } as Message));

      return { conversation, messages };
    } catch (error) {
      console.error('Error fetching conversation:', error);
      throw error;
    }
  },

  // Create a new conversation
  createConversation: async (
    adminId: string,
    adminName: string,
    userId: string,
    userName: string
  ): Promise<string> => {
    try {
      // Check if conversation already exists
      const existingQuery = query(
        collection(db, CONVERSATIONS_COLLECTION),
        where('participants', 'array-contains', adminId)
      );
      const existingSnapshot = await getDocs(existingQuery);
      
      const existing = existingSnapshot.docs.find(doc => {
        const participants = doc.data().participants as string[];
        return participants.includes(userId) && participants.length === 2;
      });

      if (existing) {
        return existing.id;
      }

      // Create new conversation
      const docRef = await addDoc(collection(db, CONVERSATIONS_COLLECTION), {
        participants: [adminId, userId],
        participantNames: {
          [adminId]: adminName,
          [userId]: userName
        },
        lastMessage: '',
        lastMessageTime: Timestamp.now(),
        unreadCount: {
          [adminId]: 0,
          [userId]: 0
        },
        createdAt: Timestamp.now()
      });

      return docRef.id;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  },

  // Send a message
  sendMessage: async (
    conversationId: string,
    senderId: string,
    senderName: string,
    text: string
  ): Promise<void> => {
    try {
      // Add message to subcollection
      await addDoc(
        collection(db, CONVERSATIONS_COLLECTION, conversationId, MESSAGES_SUBCOLLECTION),
        {
          senderId,
          senderName,
          text,
          timestamp: Timestamp.now(),
          read: false
        }
      );

      // Update conversation last message
      const conversationRef = doc(db, CONVERSATIONS_COLLECTION, conversationId);
      const conversationDoc = await getDoc(conversationRef);
      
      if (conversationDoc.exists()) {
        const participants = conversationDoc.data().participants as string[];
        const unreadCount = conversationDoc.data().unreadCount as Record<string, number>;
        
        // Increment unread count for all participants except sender
        const updatedUnreadCount = { ...unreadCount };
        participants.forEach(participantId => {
          if (participantId !== senderId) {
            updatedUnreadCount[participantId] = (updatedUnreadCount[participantId] || 0) + 1;
          }
        });

        await updateDoc(conversationRef, {
          lastMessage: text.substring(0, 100), // Truncate for preview
          lastMessageTime: Timestamp.now(),
          unreadCount: updatedUnreadCount
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  },

  // Mark messages as read
  markAsRead: async (conversationId: string, userId: string): Promise<void> => {
    try {
      const conversationRef = doc(db, CONVERSATIONS_COLLECTION, conversationId);
      const conversationDoc = await getDoc(conversationRef);
      
      if (conversationDoc.exists()) {
        const unreadCount = conversationDoc.data().unreadCount as Record<string, number>;
        const updatedUnreadCount = { ...unreadCount, [userId]: 0 };

        await updateDoc(conversationRef, {
          unreadCount: updatedUnreadCount
        });
      }
    } catch (error) {
      console.error('Error marking as read:', error);
      throw error;
    }
  }
};
