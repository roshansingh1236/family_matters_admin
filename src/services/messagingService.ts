
import { supabase } from '../lib/supabase';

export interface Conversation {
  id?: string;
  participants: string[]; // User IDs 
  participantNames: Record<string, string>; // ID -> Name mapping
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: Record<string, number>; // User ID -> unread count
  createdAt?: string;
}

export interface Message {
  id?: string;
  senderId: string;
  senderName: string;
  text: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'file';
  replyTo?: string; 
  timestamp: string;
  read: boolean;
}

export const messagingService = {
  // Get all conversations where admin is a participant
  getConversations: async (adminId: string): Promise<Conversation[]> => {
    try {
      const { data, error } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          conversations (
            id,
            last_message,
            last_message_at,
            created_at,
            conversation_participants (
              user_id,
              users ( full_name )
            )
          )
        `)
        .eq('user_id', adminId);

      if (error) throw error;

      return (data || []).map((cp: any) => {
          const conv = cp.conversations;
          const participantIds = conv.conversation_participants.map((p: any) => p.user_id);
          const names = conv.conversation_participants.reduce((acc: any, p: any) => {
              acc[p.user_id] = p.users?.full_name || 'Unknown';
              return acc;
          }, {});
          
          return {
              id: conv.id,
              participants: participantIds,
              participantNames: names,
              lastMessage: conv.last_message,
              lastMessageTime: conv.last_message_at,
              unreadCount: {}, // Simplified
              createdAt: conv.created_at
          } as Conversation;
      });
    } catch (error) {
      console.error('Error fetching conversations:', error);
      throw error;
    }
  },

  // Get a specific conversation with its messages
  getConversationById: async (conversationId: string): Promise<{ conversation: Conversation; messages: Message[] }> => {
    try {
      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .select(`
            *,
            conversation_participants (
                user_id,
                users ( full_name )
            )
        `)
        .eq('id', conversationId)
        .maybeSingle();
      
      if (convError) throw convError;
      if (!convData) throw new Error('Conversation not found');

      const participantIds = (convData as any).conversation_participants.map((p: any) => p.user_id);
      const names = (convData as any).conversation_participants.reduce((acc: any, p: any) => {
          acc[p.user_id] = p.users?.full_name || 'Unknown';
          return acc;
      }, {});

      const conversation: Conversation = {
          id: (convData as any).id,
          participants: participantIds,
          participantNames: names,
          lastMessage: (convData as any).last_message,
          lastMessageTime: (convData as any).last_message_at,
          unreadCount: {},
          createdAt: (convData as any).created_at
      };

      // Fetch messages
      const { data: msgData, error: msgError } = await supabase
        .from('messages')
        .select(`
            *,
            sender:sender_id ( full_name )
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      
      if (msgError) throw msgError;

      const messages: Message[] = (msgData || []).map(m => ({
          id: m.id,
          senderId: m.sender_id,
          senderName: m.sender?.full_name || 'Unknown',
          text: m.content,
          mediaUrl: m.attachments?.[0],
          timestamp: m.created_at,
          read: m.is_read
      }));

      return { conversation, messages };
    } catch (error) {
      console.error('Error fetching conversation:', error);
      throw error;
    }
  },

  // Create a new conversation
  createConversation: async (
    adminId: string,
    userId: string
  ): Promise<string> => {
    try {
      // Check if conversation already exists (simplified to check for exact pair in participants table)
      // This logic is better handled via an RPC or clever select in Supabase, 
      // but for similarity to the original:
      const { data: existing, error: existError } = await supabase.rpc('find_conversation_by_participants', {
          p_user_ids: [adminId, userId]
      });

      if (!existError && existing) return existing;

      // Create new conversation
      const { data: conv, error: convError } = await supabase
        .from('conversations')
        .insert({ last_message: 'Started a new conversation' })
        .select('id')
        .maybeSingle();
      
      if (convError) throw convError;
      if (!conv) throw new Error('Failed to create conversation');

      // Add participants
      await supabase.from('conversation_participants').insert([
          { conversation_id: conv.id, user_id: adminId, role: 'admin' },
          { conversation_id: conv.id, user_id: userId, role: 'user' }
      ]);

      return conv.id;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  },

  // Send a message
  sendMessage: async (
    conversationId: string,
    senderId: string,
    text: string,
    media?: { url: string; type: 'image' | 'file' }
  ): Promise<void> => {
    try {
      const { error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          content: text,
          attachments: media?.url ? [media.url] : [],
          is_read: false
        });
      
      if (msgError) throw msgError;

      // Update conversation
      await supabase
        .from('conversations')
        .update({
            last_message: media ? `Sent a ${media.type}` : text.substring(0, 100),
            last_message_at: new Date().toISOString()
        })
        .eq('id', conversationId);

    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  },

  // Mark messages as read
  markAsRead: async (conversationId: string, userId: string): Promise<void> => {
    try {
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', userId);
    } catch (error) {
      console.error('Error marking as read:', error);
      throw error;
    }
  },

  // Delete a message
  deleteMessage: async (messageId: string): Promise<void> => {
    try {
      await supabase.from('messages').delete().eq('id', messageId);
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  },

  // Clear all messages in a conversation
  clearChat: async (conversationId: string): Promise<void> => {
    try {
      await supabase.from('messages').delete().eq('conversation_id', conversationId);
      await supabase.from('conversations').update({ last_message: 'Chat cleared' }).eq('id', conversationId);
    } catch (error) {
      console.error('Error clearing chat:', error);
      throw error;
    }
  },

  // Delete an entire conversation
  deleteConversation: async (conversationId: string): Promise<void> => {
    try {
      await supabase.from('conversations').delete().eq('id', conversationId);
    } catch (error) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  }
};



