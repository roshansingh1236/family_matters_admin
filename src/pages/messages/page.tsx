import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';
import { messagingService, type Conversation, type Message } from '../../services/messagingService';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const MessagesPage: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const adminId = 'admin123'; // In production, get from auth context
  const adminName = 'Admin'; // In production, get from auth context

  const fetchConversations = async () => {
    setIsLoading(true);
    try {
      const data = await messagingService.getConversations(adminId);
      setConversations(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to load conversations');
      setConversations([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        name: (doc.data().firstName || doc.data().email || 'Unknown User') as string
      }));
      setUsers(usersData);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const loadConversation = async (conversation: Conversation) => {
    try {
      const { messages: msgs } = await messagingService.getConversationById(conversation.id!);
      setMessages(msgs);
      setSelectedConversation(conversation);
      
      // Mark as read
      await messagingService.markAsRead(conversation.id!, adminId);
      await fetchConversations(); // Refresh to update unread count
      
      // Scroll to bottom
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      console.error('Error loading conversation:', err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedConversation) return;

    try {
      await messagingService.sendMessage(
        selectedConversation.id!,
        adminId,
        adminName,
        messageText.trim()
      );
      
      setMessageText('');
      await loadConversation(selectedConversation);
      await fetchConversations();
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
    }
  };

  const handleCreateConversation = async () => {
    if (!selectedUserId) return;

    try {
      const user = users.find(u => u.id === selectedUserId);
      if (!user) return;

      const conversationId = await messagingService.createConversation(
        adminId,
        adminName,
        selectedUserId,
        user.name
      );

      await fetchConversations();
      setShowNewConversation(false);
      setSelectedUserId('');

      // Load the new conversation
      const newConv = conversations.find(c => c.id === conversationId);
      if (newConv) {
        await loadConversation(newConv);
      }
    } catch (err) {
      console.error('Error creating conversation:', err);
      setError('Failed to create conversation');
    }
  };

  useEffect(() => {
    fetchConversations();
    fetchUsers();
  }, []);

  const getOtherParticipantName = (conversation: Conversation) => {
    const otherParticipantId = conversation.participants.find(p => p !== adminId);
    return otherParticipantId ? conversation.participantNames[otherParticipantId] : 'Unknown';
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 24) {
      return new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else {
      return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-hidden p-6">
          <div className="h-full flex flex-col">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Messages</h1>
                <p className="text-gray-600 dark:text-gray-400">Admin messaging center.</p>
              </div>
              <Button color="blue" onClick={() => setShowNewConversation(true)}>
                <i className="ri-add-line mr-2"></i>
                New Conversation
              </Button>
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex-1 flex gap-6 overflow-hidden">
              {/* Conversations List */}
              <div className="w-80 flex-shrink-0 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="font-semibold text-gray-900 dark:text-white">Conversations</h2>
                </div>
                
                <div className="flex-1 overflow-y-auto">
                  {isLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <i className="ri-loader-4-line text-2xl animate-spin text-blue-600"></i>
                    </div>
                  ) : conversations.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                      <i className="ri-message-3-line text-3xl mb-2"></i>
                      <p className="text-sm">No conversations yet</p>
                    </div>
                  ) : (
                    conversations.map((conv) => (
                      <button
                        key={conv.id}
                        onClick={() => loadConversation(conv)}
                        className={`w-full p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left ${
                          selectedConversation?.id === conv.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {getOtherParticipantName(conv)}
                          </span>
                          {conv.unreadCount[adminId] > 0 && (
                            <Badge color="blue">{conv.unreadCount[adminId]}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                          {conv.lastMessage || 'No messages yet'}
                        </p>
                        <span className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          {formatTime(conv.lastMessageTime)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Messages Panel */}
              <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
                {selectedConversation ? (
                  <>
                    {/* Header */}
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                      <h2 className="font-semibold text-gray-900 dark:text-white">
                        {getOtherParticipantName(selectedConversation)}
                      </h2>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {messages.map((msg, index) => {
                        const isAdmin = msg.senderId === adminId;
                        return (
                          <div
                            key={index}
                            className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[70%] rounded-lg px-4 py-2 ${
                                isAdmin
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                              }`}
                            >
                              <p className="text-sm">{msg.text}</p>
                              <span className={`text-xs mt-1 block ${
                                isAdmin ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                              }`}>
                                {formatTime(msg.timestamp)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={messageText}
                          onChange={(e) => setMessageText(e.target.value)}
                          placeholder="Type a message..."
                          className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <Button type="submit" color="blue" disabled={!messageText.trim()}>
                          <i className="ri-send-plane-fill"></i>
                        </Button>
                      </div>
                    </form>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
                    <div className="text-center">
                      <i className="ri-message-3-line text-6xl mb-4"></i>
                      <p>Select a conversation to start messaging</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* New Conversation Modal */}
          {showNewConversation && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
              <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full shadow-2xl">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">New Conversation</h2>
                    <button
                      onClick={() => setShowNewConversation(false)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <i className="ri-close-line text-xl text-gray-600 dark:text-gray-400"></i>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Select User
                      </label>
                      <select
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="">Choose a user...</option>
                        {users.map(user => (
                          <option key={user.id} value={user.id}>{user.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setShowNewConversation(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        color="blue"
                        className="flex-1"
                        onClick={handleCreateConversation}
                        disabled={!selectedUserId}
                      >
                        Start Conversation
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default MessagesPage;
