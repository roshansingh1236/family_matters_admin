import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Toast from '../../components/base/Toast';
import { contactService, type Contact, type ContactCategory } from '../../services/contactService';
import { messagingService } from '../../services/messagingService';
import { useAuth } from '../../contexts/AuthContext';

const ContactsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [activeCategory, setActiveCategory] = useState<ContactCategory>('Surrogates');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  // New Contact Form State
  const [newContact, setNewContact] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    category: 'IVF Clinics' as ContactCategory,
    notes: ''
  });

  const categories: ContactCategory[] = ['Surrogates', 'Intended Parents', 'IVF Clinics', 'Medical Facilities'];

  const fetchContacts = async () => {
    setIsLoading(true);
    try {
      const data = await contactService.getContacts();
      setContacts(data);
    } catch (err) {
      console.error('Error fetching contacts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const filteredContacts = useMemo(() => {
    return contacts.filter(c => {
      const matchesCategory = c.category === activeCategory;
      const matchesSearch = 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [contacts, activeCategory, searchQuery]);

  const handleAction = async (contact: Contact, action: 'message' | 'history') => {
    if (action === 'message') {
      if (contact.isExternal) {
        if (contact.email && contact.email !== 'N/A') {
          window.open(`mailto:${contact.email}`, '_blank');
        } else {
          setToast({ message: "No email address available for this partner.", type: "error" });
        }
        return;
      }

      if (!currentUser?.id) {
        setToast({ message: "You must be logged in to send messages.", type: "error" });
        return;
      }

      try {
        setToast({ message: "Creating chat...", type: "success" });
        const convId = await messagingService.createConversation(currentUser.id, contact.id);
        navigate(`/messages?conv=${convId}`);
      } catch (err) {
        console.error("Failed to start conversation:", err);
        setToast({ message: "Failed to start conversation.", type: "error" });
      }
    } else {
      if (contact.category === 'Surrogates') {
        navigate(`/surrogates/${contact.id}`);
      } else if (contact.category === 'Intended Parents') {
        navigate(`/parents/${contact.id}`);
      } else {
        navigate(`/contacts/${contact.id}`);
      }
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await contactService.createExternalPartner(newContact);
      setToast({ message: "Contact added successfully!", type: "success" });
      setShowAddModal(false);
      setNewContact({ name: '', email: '', phone: '', address: '', category: 'IVF Clinics', notes: '' });
      fetchContacts();
    } catch (err) {
      setToast({ message: "Failed to add contact.", type: "error" });
    }
  };

  const getInitials = (name: string) => 
    name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  return (
    <div className="flex h-screen bg-[#fdf4f6] dark:bg-[#0e0b1a]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Contacts</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage external partners and stakeholders.</p>
            </div>
            <Button color="blue" onClick={() => setShowAddModal(true)}>
              <i className="ri-user-add-line mr-2"></i>Add Contact
            </Button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            <div className="space-y-4">
              <Card className="p-2 border-rose-100/60 dark:border-white/5">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                      activeCategory === cat 
                        ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-500/20' 
                        : 'text-gray-600 dark:text-gray-400 hover:bg-rose-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <span>{cat}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      activeCategory === cat ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-500'
                    }`}>
                      {contacts.filter(c => c.category === cat).length}
                    </span>
                  </button>
                ))}
              </Card>

              <Card className="p-4 bg-gradient-to-br from-rose-50/50 to-pink-50/50 dark:from-rose-500/5 dark:to-purple-500/5 border-rose-100 dark:border-white/5">
                <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] mb-3">Quick Search</h4>
                <div className="relative">
                  <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                  <input
                    type="text"
                    placeholder="Name, email, phone..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-[#15111f] border border-rose-100 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 outline-none transition-all"
                  />
                </div>
              </Card>
            </div>

            <div className="xl:col-span-3">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-64">
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center mb-4">
                    <i className="ri-loader-4-line text-2xl animate-spin text-rose-500"></i>
                  </div>
                  <p className="text-sm text-gray-500 font-medium">Loading contacts...</p>
                </div>
              ) : filteredContacts.length === 0 ? (
                <Card className="p-16 text-center border-dashed border-2 border-rose-100 dark:border-white/5 bg-transparent">
                  <div className="w-20 h-20 bg-rose-50 dark:bg-rose-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <i className="ri-user-search-line text-3xl text-rose-400"></i>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">No contacts found</h3>
                  <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">We couldn't find any {activeCategory.toLowerCase()} matching your criteria.</p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredContacts.map(contact => (
                    <Card 
                      key={contact.id} 
                      className="group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-rose-100/50 dark:border-white/5 relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-rose-500 to-purple-600 opacity-[0.03] blur-2xl rounded-full -mr-12 -mt-12 group-hover:opacity-[0.08] transition-opacity"></div>
                      
                      <div className="flex items-start gap-5 relative z-10">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 via-pink-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-rose-500/20 flex-shrink-0">
                          {getInitials(contact.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-bold text-gray-900 dark:text-white truncate text-base leading-tight">{contact.name}</h3>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => handleAction(contact, 'message')}
                                className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-white/5 rounded-lg transition-colors"
                                title={contact.isExternal ? 'Email' : 'Message'}
                              >
                                <i className={`${contact.isExternal ? 'ri-mail-line' : 'ri-chat-3-line'} text-base`}></i>
                              </button>
                              <button 
                                onClick={() => handleAction(contact, 'history')}
                                className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-white/5 rounded-lg transition-colors"
                                title="View Detail"
                              >
                                <i className="ri-external-link-line text-base"></i>
                              </button>
                            </div>
                          </div>
                          
                          <div className="mt-3 space-y-2">
                            <div className="flex items-center gap-3 group/item">
                              <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-500 group-hover/item:bg-rose-500 group-hover/item:text-white transition-all">
                                <i className="ri-mail-line text-sm"></i>
                              </div>
                              <span className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate">{contact.email}</span>
                            </div>
                            
                            <div className="flex items-center gap-3 group/item">
                              <div className="w-7 h-7 rounded-lg bg-pink-50 dark:bg-pink-500/10 flex items-center justify-center text-pink-500 group-hover/item:bg-pink-500 group-hover/item:text-white transition-all">
                                <i className="ri-phone-line text-sm"></i>
                              </div>
                              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{contact.phone}</span>
                            </div>
                            
                            <div className="flex items-center gap-3 group/item">
                              <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-purple-500 group-hover/item:bg-purple-500 group-hover/item:text-white transition-all">
                                <i className="ri-map-pin-line text-sm"></i>
                              </div>
                              <span className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate">{contact.address}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-5 pt-4 border-t border-rose-50 dark:border-white/5 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleAction(contact, 'message')}
                          className="flex-1 py-2 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-bold uppercase tracking-wider hover:bg-rose-500 hover:text-white transition-all"
                        >
                          {contact.isExternal ? 'Email Partner' : 'Send Message'}
                        </button>
                        <button 
                          onClick={() => handleAction(contact, 'history')}
                          className="flex-1 py-2 rounded-lg bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase tracking-wider hover:bg-gray-200 dark:hover:bg-gray-800 transition-all"
                        >
                          {contact.isExternal ? 'View Profile' : 'View History'}
                        </button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold dark:text-white">Add External Partner</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600"><i className="ri-close-line text-2xl"></i></button>
            </div>
            <form onSubmit={handleAddContact} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Category</label>
                <select 
                  className="w-full mt-1 p-2.5 rounded-xl border border-rose-100 dark:border-white/10 dark:bg-[#15111f] dark:text-white"
                  value={newContact.category}
                  onChange={e => setNewContact({...newContact, category: e.target.value as ContactCategory})}
                >
                  <option value="IVF Clinics">IVF Clinic</option>
                  <option value="Medical Facilities">Medical Facility</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Name</label>
                <input 
                  type="text" required placeholder="Partner Name"
                  className="w-full mt-1 p-2.5 rounded-xl border border-rose-100 dark:border-white/10 dark:bg-[#15111f] dark:text-white"
                  value={newContact.name}
                  onChange={e => setNewContact({...newContact, name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Email</label>
                  <input 
                    type="email" placeholder="email@example.com"
                    className="w-full mt-1 p-2.5 rounded-xl border border-rose-100 dark:border-white/10 dark:bg-[#15111f] dark:text-white"
                    value={newContact.email}
                    onChange={e => setNewContact({...newContact, email: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Phone</label>
                  <input 
                    type="text" placeholder="(555) 000-0000"
                    className="w-full mt-1 p-2.5 rounded-xl border border-rose-100 dark:border-white/10 dark:bg-[#15111f] dark:text-white"
                    value={newContact.phone}
                    onChange={e => setNewContact({...newContact, phone: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Address</label>
                <input 
                  type="text" placeholder="Full address"
                  className="w-full mt-1 p-2.5 rounded-xl border border-rose-100 dark:border-white/10 dark:bg-[#15111f] dark:text-white"
                  value={newContact.address}
                  onChange={e => setNewContact({...newContact, address: e.target.value})}
                />
              </div>
              <div className="pt-4 flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowAddModal(false)}>Cancel</Button>
                <Button color="blue" className="flex-1" type="submit">Save Contact</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ContactsPage;
