import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Button from '../../components/base/Button';
import { useAuth } from '../../contexts/AuthContext';

import { messagingService, type Conversation, type Message } from '../../services/messagingService';
import { supabase } from '../../lib/supabase';
import SearchableDropdown from '../../components/base/SearchableDropdown';
import { MoreVertical, Smile, Paperclip, Send, Trash2, Reply, Image as ImageIcon, File as FileIcon, X } from 'lucide-react';


// Helper for user avatars
const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const getAvatarColor = (name: string) => {
  const colors = [
    'bg-blue-500', 'bg-purple-500', 'bg-indigo-500', 
    'bg-pink-500', 'bg-teal-500', 'bg-orange-500'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};


const MessagesPage: React.FC = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ file: File; type: 'image' | 'file' } | null>(null);
  const [activeMessageOptions, setActiveMessageOptions] = useState<string | null>(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const adminId = user?.id || ''; // Use actual user ID

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
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('id, email, full_name, role');

      if (fetchError) throw fetchError;

      const usersData = (data || []).map(u => ({
        id: u.id,
        name: (u.full_name || u.email || 'Unknown User') as string
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
      
      // Scroll to bottom manually to avoid page-level shifts
      if (scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        setTimeout(() => {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth'
          });
        }, 100);
      }
    } catch (err) {
      console.error('Error loading conversation:', err);
    }

  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!messageText.trim() && !selectedMedia) || !selectedConversation) return;

    try {
      let mediaData = undefined;

      if (selectedMedia) {
        setIsUploading(true);
        const fileExt = selectedMedia.file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `messages/${selectedConversation.id}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('messages')
          .upload(filePath, selectedMedia.file);
          
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('messages')
          .getPublicUrl(filePath);
          
        mediaData = { url: publicUrl, type: selectedMedia.type };
      }

      await messagingService.sendMessage(
        selectedConversation.id!,
        adminId,
        messageText.trim(),
        mediaData
      );
      
      setMessageText('');
      setSelectedMedia(null);
      setReplyTo(null);
      setShowEmojiPicker(false);
      await loadConversation(selectedConversation);
      await fetchConversations();
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const type = file.type.startsWith('image/') ? 'image' : 'file';
      setSelectedMedia({ file, type });
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!selectedConversation) return;
    try {
      await messagingService.deleteMessage(messageId);
      await loadConversation(selectedConversation);
      setActiveMessageOptions(null);
    } catch (err) {
      console.error('Error deleting message:', err);
      setError('Failed to delete message');
    }
  };

  const addEmoji = (emoji: string) => {
    setMessageText(prev => prev + emoji);
  };

  const emojis = ['😊', '😂', '👋', '👍', '🙏', '❤️', '🔥', '✨', '🙌', '😎', '💡', '✅', '❌', '⚠️'];


  const handleCreateConversation = async () => {
    if (!selectedUserId) return;

    try {
      const user = users.find(u => u.id === selectedUserId);
      if (!user) return;

      const conversationId = await messagingService.createConversation(
        adminId,
        selectedUserId
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

  const handleClearChat = async () => {
    if (!selectedConversation) return;
    if (!window.confirm('Are you sure you want to clear all messages? This cannot be undone.')) return;
    
    try {
      await messagingService.clearChat(selectedConversation.id!);
      await loadConversation(selectedConversation);
      setShowHeaderMenu(false);
    } catch (err) {
      console.error('Error clearing chat:', err);
      setError('Failed to clear chat');
    }
  };

  const handleDeleteConversation = async () => {
    if (!selectedConversation) return;
    if (!window.confirm('Delete this entire conversation? All messages will be lost.')) return;

    try {
      await messagingService.deleteConversation(selectedConversation.id!);
      setSelectedConversation(null);
      await fetchConversations();
      setShowHeaderMenu(false);
    } catch (err) {
      console.error('Error deleting conversation:', err);
      setError('Failed to delete conversation');
    }
  };


  useEffect(() => {
    fetchConversations();
    fetchUsers();

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.emoji-trigger') && !target.closest('.emoji-picker')) {
        setShowEmojiPicker(false);
      }
      if (!target.closest('.message-options-trigger') && !target.closest('.message-options-menu')) {
        setActiveMessageOptions(null);
      }
      if (!target.closest('.header-menu-trigger') && !target.closest('.header-menu')) {
        setShowHeaderMenu(false);
      }
    };


    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
    } else if (hours < 48) {
      return 'Yesterday';
    } else {
      return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };


  return (
    <div className="flex h-screen bg-[#f8fafc] dark:bg-[#0f172a] overflow-hidden relative">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/10 dark:bg-blue-600/5 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-400/10 dark:bg-indigo-600/5 blur-[120px] rounded-full pointer-events-none"></div>

      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        <Header />
        
        <main className="flex-1 overflow-hidden p-4 md:p-6 lg:p-8">
          <div className="h-full flex flex-col max-w-7xl mx-auto w-full">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">
                  Messages
                </h1>
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  <p className="text-sm font-medium">Secure Communication Hub</p>
                </div>
              </div>
              <Button 
                color="blue" 
                onClick={() => setShowNewConversation(true)}
                className="shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all duration-300 scale-105 active:scale-95"
              >
                <i className="ri-add-line mr-2 text-lg"></i>
                <span className="font-semibold">Start Chat</span>
              </Button>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50/80 dark:bg-red-900/20 backdrop-blur-md border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top duration-300">
                <i className="ri-error-warning-line text-xl"></i>
                <span className="font-medium">{error}</span>
              </div>
            )}

            <div className="flex-1 flex gap-6 overflow-hidden">

              {/* Conversations List */}
              <div className="w-80 lg:w-96 flex-shrink-0 bg-white/70 dark:bg-slate-800/50 backdrop-blur-xl rounded-[2rem] border border-white/20 dark:border-slate-700/50 shadow-2xl flex flex-col overflow-hidden transition-all duration-500 hover:shadow-blue-500/5">
                <div className="p-6 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                  <h2 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                    <i className="ri-chat-history-line text-blue-500"></i>
                    Conversations
                  </h2>
                  <span className="text-xs font-bold px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-500">
                    {conversations.length}
                  </span>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-3">
                      <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Loading Chats</p>
                    </div>
                  ) : conversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-50/50 dark:bg-slate-900/20 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
                        <i className="ri-chat-smile-2-line text-3xl text-slate-300"></i>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 font-medium">No active connections</p>
                      <button 
                        onClick={() => setShowNewConversation(true)}
                        className="mt-4 text-blue-500 text-sm font-bold hover:underline"
                      >
                        Start your first chat
                      </button>
                    </div>
                  ) : (
                    conversations.map((conv) => {
                      const otherName = getOtherParticipantName(conv);
                      const isSelected = selectedConversation?.id === conv.id;
                      return (
                        <button
                          key={conv.id}
                          onClick={() => loadConversation(conv)}
                          className={`w-full p-4 rounded-2xl transition-all duration-300 text-left group relative overflow-hidden ${
                            isSelected 
                              ? 'bg-blue-500 dark:bg-blue-600 shadow-lg shadow-blue-500/20' 
                              : 'hover:bg-white dark:hover:bg-slate-700/50'
                          }`}
                        >
                          {isSelected && (
                            <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent"></div>
                          )}
                          <div className="flex items-center gap-4 relative z-10">
                            <div className={`w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center font-bold text-white shadow-md ${
                              isSelected ? 'bg-white/20' : getAvatarColor(otherName)
                            }`}>
                              {getInitials(otherName)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className={`font-bold truncate ${isSelected ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                                  {otherName}
                                </span>
                                <span className={`text-[10px] font-bold uppercase tracking-tighter ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                                  {formatTime(new Date(conv.lastMessageTime))}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <p className={`text-xs truncate ${isSelected ? 'text-blue-50' : 'text-slate-500 dark:text-slate-400'}`}>
                                  {conv.lastMessage || 'Sent a secure message'}
                                </p>
                                {conv.unreadCount[adminId] > 0 && (
                                  <span className="flex-shrink-0 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold ring-2 ring-white dark:ring-slate-800 animate-bounce">
                                    {conv.unreadCount[adminId]}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Messages Panel */}
              <div className="flex-1 bg-white/70 dark:bg-slate-800/50 backdrop-blur-xl rounded-[2rem] border border-white/20 dark:border-slate-700/50 shadow-2xl flex flex-col overflow-hidden relative">
                {selectedConversation ? (
                  <>
                    {/* Header */}
                    <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between bg-white/30 dark:bg-slate-800/30">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white ${getAvatarColor(getOtherParticipantName(selectedConversation))}`}>
                          {getInitials(getOtherParticipantName(selectedConversation))}
                        </div>
                        <div>
                          <h2 className="font-bold text-slate-900 dark:text-white leading-tight">
                            {getOtherParticipantName(selectedConversation)}
                          </h2>
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Member</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 relative">
                        <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-400">
                          <i className="ri-phone-line text-lg"></i>
                        </button>
                        <button 
                          onClick={() => setShowHeaderMenu(!showHeaderMenu)}
                          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-400 header-menu-trigger"
                        >
                          <i className="ri-more-2-fill text-lg"></i>
                        </button>

                        {showHeaderMenu && (
                          <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-2 z-30 animate-in zoom-in-95 duration-200 header-menu">
                            <button 
                              onClick={() => { /* View Profile logic */ }}
                              className="w-full text-left px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl flex items-center gap-3 transition-colors"
                            >
                              <i className="ri-user-settings-line text-lg text-blue-500"></i> View Profile
                            </button>
                            <button 
                              onClick={handleClearChat}
                              className="w-full text-left px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl flex items-center gap-3 transition-colors"
                            >
                              <i className="ri-delete-bin-line text-lg text-orange-500"></i> Clear Chat
                            </button>
                            <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-2"></div>
                            <button 
                              onClick={handleDeleteConversation}
                              className="w-full text-left px-4 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl flex items-center gap-3 transition-colors"
                            >
                              <i className="ri-chat-delete-line text-lg"></i> Delete Chat
                            </button>
                          </div>
                        )}
                      </div>

                    </div>

                    {/* Messages Area */}
                    <div 
                      ref={scrollContainerRef}
                      className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar bg-slate-50/30 dark:bg-slate-900/10"
                    >

                      {messages.map((msg, index) => {
                        const isAdmin = msg.senderId === adminId;
                        const showTime = index === 0 || 
                          new Date(msg.timestamp).getTime() - new Date(messages[index-1].timestamp).getTime() > 300000;
                        const repliedMessage = msg.replyTo ? messages.find(m => m.id === msg.replyTo) : null;

                        return (
                          <div key={index} className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300 group">
                            {showTime && (
                              <div className="flex justify-center mb-4">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800/80 px-3 py-1 rounded-full backdrop-blur-sm">
                                  {formatTime(new Date(msg.timestamp))}
                                </span>
                              </div>
                            )}
                            <div className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                              <div className={`group relative max-w-[80%] md:max-w-[70%] ${isAdmin ? 'items-end' : 'items-start'}`}>
                                
                                {repliedMessage && (
                                  <div className={`mb-1 px-3 py-1.5 rounded-xl text-[11px] border-l-4 border-blue-500 bg-slate-100 dark:bg-slate-800 text-slate-500 max-w-full truncate`}>
                                    <span className="font-bold block text-blue-500 mb-0.5">{repliedMessage.senderName}</span>
                                    {repliedMessage.text || 'Media attachment'}
                                  </div>
                                )}

                                <div
                                  className={`rounded-2xl shadow-sm transition-all duration-300 relative ${
                                    isAdmin
                                      ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-tr-none shadow-blue-500/10 hover:shadow-blue-500/20'
                                      : 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-tl-none border border-white/50 dark:border-slate-600/50 hover:border-blue-200 dark:hover:border-blue-900'
                                  }`}
                                >
                                  {msg.mediaUrl && (
                                    <div className="mb-2 overflow-hidden rounded-xl">
                                      {msg.mediaType === 'image' ? (
                                        <img src={msg.mediaUrl} alt="attachment" className="max-w-full rounded-lg hover:scale-[1.02] transition-transform cursor-pointer" onClick={() => window.open(msg.mediaUrl, '_blank')} />
                                      ) : (
                                        <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
                                          <FileIcon size={20} />
                                          <span className="text-sm font-medium">Download Attachment</span>
                                        </a>
                                      )}
                                    </div>
                                  )}
                                  {msg.text && <p className="text-[15px] leading-relaxed font-medium px-5 py-3">{msg.text}</p>}
                                  
                                  {/* Message Options Menu */}
                                  <div className={`absolute top-0 ${isAdmin ? 'right-full mr-2' : 'left-full ml-2'} opacity-0 group-hover:opacity-100 transition-opacity flex items-center`}>
                                    <button 
                                      onClick={() => setActiveMessageOptions(activeMessageOptions === msg.id ? null : msg.id!)}
                                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 message-options-trigger"
                                    >
                                      <MoreVertical size={16} />
                                    </button>
                                    
                                    {activeMessageOptions === msg.id && (
                                      <div className={`absolute top-full z-20 mt-1 w-32 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-1 overflow-hidden animate-in zoom-in-95 duration-200 message-options-menu ${isAdmin ? 'right-0' : 'left-0'}`}>

                                        <button 
                                          onClick={() => { setReplyTo(msg); setActiveMessageOptions(null); }}
                                          className="w-full text-left px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg flex items-center gap-2"
                                        >
                                          <Reply size={14} /> Reply
                                        </button>
                                        {isAdmin && (
                                          <button 
                                            onClick={() => handleDeleteMessage(msg.id!)}
                                            className="w-full text-left px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex items-center gap-2"
                                          >
                                            <Trash2 size={14} /> Delete
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className={`flex items-center gap-2 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${isAdmin ? 'flex-row-reverse' : 'flex-row'}`}>
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                    {isAdmin ? 'Delivered' : getOtherParticipantName(selectedConversation)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      <div ref={messagesEndRef} />
                    </div>

                    {/* Enhanced Input Bar */}
                    <div className="p-6 bg-white/30 dark:bg-slate-800/30 backdrop-blur-md border-t border-slate-100 dark:border-slate-700/50">
                      
                      {/* Reply/Media Previews */}
                      <div className="max-w-4xl mx-auto mb-3 space-y-2">
                        {replyTo && (
                          <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 animate-in slide-in-from-bottom-2 duration-200">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <Reply size={16} className="text-blue-500 flex-shrink-0" />
                              <div className="min-w-0">
                                <span className="text-[10px] font-bold text-blue-500 uppercase block">Replying to {replyTo.senderName}</span>
                                <p className="text-xs text-slate-600 dark:text-slate-400 truncate">{replyTo.text || 'Media'}</p>
                              </div>
                            </div>
                            <button onClick={() => setReplyTo(null)} className="text-slate-400 hover:text-red-500 p-1">
                              <X size={16} />
                            </button>
                          </div>
                        )}
                        {selectedMedia && (
                          <div className="flex items-center justify-between p-3 bg-teal-50 dark:bg-teal-900/20 rounded-xl border border-teal-200 dark:border-teal-800 animate-in slide-in-from-bottom-2 duration-200">
                            <div className="flex items-center gap-3">
                              {selectedMedia.type === 'image' ? <ImageIcon size={20} className="text-teal-500" /> : <FileIcon size={20} className="text-teal-500" />}
                              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{selectedMedia.file.name}</span>
                            </div>
                            <button onClick={() => setSelectedMedia(null)} className="text-slate-400 hover:text-red-500 p-1">
                              <X size={16} />
                            </button>
                          </div>
                        )}
                      </div>

                      <form onSubmit={handleSendMessage} className="relative max-w-4xl mx-auto flex items-center gap-3">
                        <div className="flex-1 relative group">
                          <input
                            type="text"
                            value={messageText}
                            onChange={(e) => setMessageText(e.target.value)}
                            placeholder={isUploading ? "Uploading media..." : "Type a message..."}
                            disabled={isUploading}
                            className="w-full pl-6 pr-14 py-4 rounded-[1.5rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-300 shadow-inner"
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-slate-400">
                            <button 
                              type="button" 
                              onClick={() => fileInputRef.current?.click()}
                              className="hover:text-blue-500 transition-colors p-1"
                            >
                              <Paperclip size={20} />
                            </button>
                            <input 
                              type="file" 
                              ref={fileInputRef} 
                              className="hidden" 
                              onChange={handleFileSelect}
                            />
                            <button 
                              type="button" 
                              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                              className={`hover:text-blue-500 transition-colors p-1 emoji-trigger ${showEmojiPicker ? 'text-blue-500' : ''}`}
                            >
                              <Smile size={20} />
                            </button>
                          </div>

                          {/* Emoji Picker */}
                          {showEmojiPicker && (
                            <div className="absolute bottom-full right-0 mb-4 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-20 grid grid-cols-7 gap-2 animate-in zoom-in-95 duration-200 emoji-picker">

                              {emojis.map(emoji => (
                                <button 
                                  key={emoji} 
                                  type="button"
                                  onClick={() => addEmoji(emoji)}
                                  className="text-xl hover:scale-125 transition-transform p-1"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          type="submit"
                          disabled={(!messageText.trim() && !selectedMedia) || isUploading}
                          className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                            (messageText.trim() || selectedMedia) && !isUploading
                              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30 scale-100 border-none'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 scale-95 border border-slate-200 dark:border-slate-700 cursor-not-allowed'
                          }`}
                        >
                          {isUploading ? (
                            <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin"></div>
                          ) : (
                            <Send size={24} className={`transition-transform ${(messageText.trim() || selectedMedia) ? 'translate-x-0.5 -translate-y-0.5' : ''}`} />
                          )}
                        </button>
                      </form>
                    </div>

                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center bg-slate-50/30 dark:bg-slate-900/10">
                    <div className="max-w-xs text-center animate-in fade-in zoom-in duration-700">
                      <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-blue-500/20 rotate-12">
                        <i className="ri-message-3-fill text-5xl text-white -rotate-12"></i>
                      </div>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">Select Chat</h3>
                      <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                        Stay connected with your community. Select a conversation to start messaging.
                      </p>
                      <button 
                        onClick={() => setShowNewConversation(true)}
                        className="mt-8 px-6 py-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 text-sm font-bold text-blue-500 hover:shadow-md transition-all active:scale-95"
                      >
                        Start New Journey
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* New Conversation Modal - Updated Styling */}
          {showNewConversation && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
              <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] max-w-md w-full shadow-2xl border border-white/20 overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-8">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">New Chat</h2>
                      <p className="text-sm text-slate-500 font-medium">Connect with a community member</p>
                    </div>
                    <button
                      onClick={() => setShowNewConversation(false)}
                      className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 transition-colors"
                    >
                      <i className="ri-close-line text-xl text-slate-600 dark:text-gray-300"></i>
                    </button>
                  </div>

                  <div className="space-y-8">
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-700">
                      <SearchableDropdown
                        label="Select Resident"
                        options={users}
                        value={selectedUserId}
                        onChange={(value) => setSelectedUserId(value)}
                        placeholder="Search by name..."
                        className="searchable-dropdown-custom"
                      />
                    </div>

                    <div className="flex gap-4">
                      <Button
                        variant="outline"
                        className="flex-1 h-14 rounded-2xl font-bold border-2 hover:bg-slate-50"
                        onClick={() => setShowNewConversation(false)}
                      >
                        Maybe Later
                      </Button>
                      <Button
                        color="blue"
                        className="flex-1 h-14 rounded-2xl font-bold shadow-lg shadow-blue-500/20"
                        onClick={handleCreateConversation}
                        disabled={!selectedUserId}
                      >
                        Connect Now
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
