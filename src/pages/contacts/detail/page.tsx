import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sidebar } from '../../../components/feature/Sidebar';
import Header from '../../../components/feature/Header';
import Card from '../../../components/base/Card';
import Button from '../../../components/base/Button';
import Badge from '../../../components/base/Badge';
import { supabase } from '../../../lib/supabase';
import type { Contact, ContactCategory } from '../../../services/contactService';

const ContactDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [contact, setContact] = useState<Contact | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'notes' | 'interactions'>('overview');

  useEffect(() => {
    const fetchContact = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('external_partners')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        
        setContact({
          id: data.id,
          name: data.name,
          email: data.email || 'N/A',
          phone: data.phone || 'N/A',
          address: data.address || 'N/A',
          category: data.category as ContactCategory,
          notes: data.notes,
          isExternal: true
        });
      } catch (err) {
        console.error('Error fetching partner detail:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchContact();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex h-screen bg-[#fdf4f6] dark:bg-[#0e0b1a]">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <div className="flex-1 flex items-center justify-center">
            <i className="ri-loader-4-line text-3xl animate-spin text-rose-500"></i>
          </div>
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex h-screen bg-[#fdf4f6] dark:bg-[#0e0b1a]">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <div className="flex-1 p-12 text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Contact Not Found</h2>
            <Button className="mt-4" onClick={() => navigate('/contacts')}>Back to Contacts</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#fdf4f6] dark:bg-[#0e0b1a]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 flex items-center gap-4">
            <button onClick={() => navigate('/contacts')} className="p-2 hover:bg-rose-50 dark:hover:bg-white/5 rounded-full transition-colors text-gray-500">
              <i className="ri-arrow-left-line text-xl"></i>
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{contact.name}</h1>
                <Badge color="blue">{contact.category}</Badge>
              </div>
              <p className="text-sm text-gray-500 mt-1">Partner ID: {contact.id.slice(0, 8)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-6">
              <Card className="p-6 border-rose-100/60 dark:border-white/5">
                <div className="flex flex-col items-center text-center mb-6">
                  <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-rose-500 via-pink-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold shadow-xl shadow-rose-500/20 mb-4">
                    {contact.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <h3 className="font-bold text-lg dark:text-white">{contact.name}</h3>
                  <p className="text-sm text-gray-500">{contact.category}</p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-rose-50/50 dark:bg-white/5 rounded-xl">
                    <i className="ri-mail-line text-rose-500"></i>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Email</p>
                      <p className="text-sm font-medium dark:text-white truncate">{contact.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-pink-50/50 dark:bg-white/5 rounded-xl">
                    <i className="ri-phone-line text-pink-500"></i>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Phone</p>
                      <p className="text-sm font-medium dark:text-white">{contact.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-purple-50/50 dark:bg-white/5 rounded-xl">
                    <i className="ri-map-pin-line text-purple-500"></i>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Address</p>
                      <p className="text-sm font-medium dark:text-white">{contact.address}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 space-y-3">
                  <Button color="blue" className="w-full" onClick={() => window.open(`mailto:${contact.email}`)}>
                    <i className="ri-mail-send-line mr-2"></i>Email Partner
                  </Button>
                  <Button variant="outline" className="w-full">
                    <i className="ri-edit-line mr-2"></i>Edit Details
                  </Button>
                </div>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="flex border-b border-rose-100 dark:border-white/5 gap-6">
                {['overview', 'notes', 'interactions'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`pb-3 text-sm font-bold uppercase tracking-widest transition-all border-b-2 ${
                      activeTab === tab 
                        ? 'border-rose-500 text-rose-500' 
                        : 'border-transparent text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {activeTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="p-4 bg-white dark:bg-[#15111f] border-rose-100/60 dark:border-white/5">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Quick Stats</h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Linked Surrogates</span>
                        <span className="text-sm font-bold dark:text-white">12</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Successful Transfers</span>
                        <span className="text-sm font-bold text-emerald-500">85%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Average Response Time</span>
                        <span className="text-sm font-bold text-blue-500">2.4h</span>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4 bg-white dark:bg-[#15111f] border-rose-100/60 dark:border-white/5">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Pending Tasks</h4>
                    <div className="flex flex-col items-center justify-center h-24">
                      <i className="ri-checkbox-circle-line text-emerald-400 text-2xl mb-2"></i>
                      <p className="text-xs text-gray-500">All tasks completed</p>
                    </div>
                  </Card>
                </div>
              )}

              {activeTab === 'notes' && (
                <Card className="p-6 border-rose-100/60 dark:border-white/5">
                   <div className="flex justify-between items-center mb-6">
                     <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Internal Notes</h4>
                     <Button size="sm" variant="outline"><i className="ri-add-line mr-1"></i>New Note</Button>
                   </div>
                   <div className="space-y-4">
                      {contact.notes ? (
                        <div className="p-4 bg-rose-50/30 dark:bg-white/5 rounded-xl border border-rose-100/20">
                          <p className="text-sm text-gray-600 dark:text-gray-300">{contact.notes}</p>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-sm text-gray-500 italic">No notes recorded for this partner yet.</p>
                        </div>
                      )}
                   </div>
                </Card>
              )}

              {activeTab === 'interactions' && (
                <Card className="p-6 border-rose-100/60 dark:border-white/5">
                   <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">Recent Interactions</h4>
                   <div className="space-y-6">
                      {[
                        { type: 'Email', subject: 'Transfer Schedule Confirmation', date: 'Oct 12, 2023', status: 'Completed' },
                        { type: 'Call', subject: 'Inquiry about medical records', date: 'Oct 08, 2023', status: 'Completed' },
                        { type: 'Document', subject: 'Shared Lab Results - Sarah J.', date: 'Oct 05, 2023', status: 'Pending' }
                      ].map((activity, idx) => (
                        <div key={idx} className="flex gap-4 group">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-white/5 flex items-center justify-center text-gray-400 group-hover:bg-rose-500 group-hover:text-white transition-all">
                              <i className={`${activity.type === 'Email' ? 'ri-mail-line' : activity.type === 'Call' ? 'ri-phone-line' : 'ri-file-text-line'}`}></i>
                            </div>
                            {idx < 2 && <div className="absolute top-10 left-1/2 w-0.5 h-6 bg-gray-100 dark:bg-white/5"></div>}
                          </div>
                          <div className="flex-1 pt-1">
                            <div className="flex justify-between">
                              <h5 className="text-sm font-bold dark:text-white">{activity.subject}</h5>
                              <span className="text-[10px] text-gray-400">{activity.date}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{activity.type} Interaction • {activity.status}</p>
                          </div>
                        </div>
                      ))}
                   </div>
                </Card>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ContactDetailPage;
