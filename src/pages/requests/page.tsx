import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';
import RecordInquiryDialog from '../../components/feature/RecordInquiryDialog';
import { formatMMDDYYYYOr } from '../../utils/dateFormat';

const RequestsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [inquiryType, setInquiryType] = useState<'online' | 'phone'>('online');
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const fetchedRequests = (data || []).map(u => {
        const source = u.source || 'online';
        return {
          id: u.id,
          ...u,
          applicantName: u.full_name || u.email,
          type: u.role === 'Surrogate' ? 'Surrogate Application' : 'Intended Parents',
          status: u.status || 'pending',
          source: source,
          submittedDate: formatMMDDYYYYOr(u.created_at)
        };
      });
      setRequests(fetchedRequests);
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching requests:", error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();

    const channel = supabase
      .channel('public:users:requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        fetchRequests();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  /* New state for action loading */
  const [isActionLoading, setIsActionLoading] = useState(false);

  const handleStatusUpdate = async (status: string) => {
    if (!selectedRequest) return;
    setIsActionLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          status: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;
      setSelectedRequest(null);
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status. Please try again.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleContact = () => {
    if (!selectedRequest?.email) {
      alert("No email address available for this request.");
      return;
    }
    window.open(`mailto:${selectedRequest.email}?subject=Regarding your application`, '_blank');
  };

  const handleConvertToInquiry = async () => {
    if (!selectedRequest) return;
    setIsActionLoading(true);
    try {
      // In this system, "Inquiry" is just a status.
      // If they were 'pending', we move them to 'New Inquiry' or 'New Application'
      const newStatus = selectedRequest.type === 'Surrogate Application' ? 'New Application' : 'New Inquiry';
      
      const { error } = await supabase
        .from('users')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;
      setSelectedRequest(null);
    } catch (error) {
      console.error("Error converting to inquiry:", error);
      alert("Failed to convert request.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const filteredRequests = requests.filter(req => {
    if (activeTab === 'all') return true;
    if (activeTab === 'surrogates') return req.type === 'Surrogate Application';
    if (activeTab === 'parents') return req.type === 'Intended Parents';
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return <Badge color="yellow">Pending Review</Badge>;
      case 'reviewed': return <Badge color="blue">Reviewed</Badge>;
      case 'contacted': return <Badge color="purple">Contacted</Badge>;
      case 'follow up': return <Badge color="orange">Follow Up</Badge>;
      case 'denied': return <Badge color="red">Denied</Badge>;
      case 'new inquiry':
      case 'new application': return <Badge color="green">Converted</Badge>;
      default: return <Badge color="gray">{status}</Badge>;
    }
  };

  return (
    <div className="flex h-screen bg-[#fdf4f6] dark:bg-[#0e0b1a]">
      <Sidebar collapsed={sidebarCollapsed} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inbound Requests</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Review and manage new surrogacy applications and parent inquiries.</p>
            </div>
            <div className="flex gap-3">
              <Button color="blue" onClick={() => { setInquiryType('phone'); setIsRecordDialogOpen(true); }}>
                <i className="ri-phone-line mr-2"></i>Record Phone Inquiry
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-1 mb-6 bg-white dark:bg-[#15111f] p-1 rounded-xl w-fit border border-rose-100/60 dark:border-white/5">
            {[
              { id: 'all', label: 'All Requests' },
              { id: 'surrogates', label: 'Surrogates' },
              { id: 'parents', label: 'Intended Parents' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-rose-500 text-white shadow-md' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-4">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-64 bg-white dark:bg-[#15111f] rounded-2xl border border-rose-100/60 dark:border-white/5">
                  <i className="ri-loader-4-line text-3xl animate-spin text-rose-500"></i>
                  <p className="text-sm text-gray-500 mt-2">Fetching requests...</p>
                </div>
              ) : filteredRequests.length === 0 ? (
                <Card className="p-12 text-center border-dashed border-2">
                  <i className="ri-inbox-line text-4xl text-gray-300 mb-4"></i>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">No requests found</h3>
                  <p className="text-sm text-gray-500 mt-1">New inquiries will appear here as they come in.</p>
                </Card>
              ) : (
                filteredRequests.map(req => (
                  <Card 
                    key={req.id} 
                    className={`group hover:shadow-md transition-all cursor-pointer ${selectedRequest?.id === req.id ? 'ring-2 ring-rose-500 bg-rose-50/30' : ''}`}
                    onClick={() => setSelectedRequest(req)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm ${req.type === 'Surrogate Application' ? 'bg-pink-500' : 'bg-blue-500'}`}>
                          <i className={`${req.type === 'Surrogate Application' ? 'ri-user-heart-line' : 'ri-parent-line'} text-xl`}></i>
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 dark:text-white">{req.applicantName}</h3>
                          <p className="text-xs text-gray-500">{req.type} • {req.source}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {getStatusBadge(req.status)}
                        <span className="text-[10px] text-gray-400 font-medium">{req.submittedDate}</span>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>

            <div className="space-y-4">
              {selectedRequest ? (
                <Card className="sticky top-6">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white">Request Details</h2>
                      <p className="text-xs text-gray-500 mt-1">Reviewing: {selectedRequest.applicantName}</p>
                    </div>
                    <button onClick={() => setSelectedRequest(null)} className="text-gray-400 hover:text-gray-600">
                      <i className="ri-close-line text-xl"></i>
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-xl space-y-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Contact Info</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{selectedRequest.email || 'No email provided'}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{selectedRequest.phone || 'No phone provided'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Submitted</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{selectedRequest.submittedDate}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-xs font-bold text-gray-900 dark:text-white">Workflow Actions</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="w-full" 
                          disabled={isActionLoading}
                          onClick={() => handleStatusUpdate('Reviewed')}
                        >
                          Mark Reviewed
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="w-full" 
                          disabled={isActionLoading}
                          onClick={() => handleStatusUpdate('Contacted')}
                        >
                          Mark Contacted
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="w-full" 
                          disabled={isActionLoading}
                          onClick={() => handleStatusUpdate('Follow Up')}
                        >
                          Need Follow-Up
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="w-full" 
                          color="red"
                          disabled={isActionLoading}
                          onClick={() => handleStatusUpdate('Denied')}
                        >
                          Deny Request
                        </Button>
                      </div>
                      
                      <Button 
                        color="blue" 
                        className="w-full" 
                        disabled={isActionLoading || ['new inquiry', 'new application'].includes(selectedRequest.status.toLowerCase())}
                        onClick={handleConvertToInquiry}
                      >
                        <i className="ri-check-double-line mr-2"></i>
                        Convert to Lead/Inquiry
                      </Button>
                    </div>

                    <div className="pt-6 border-t border-rose-100/60 dark:border-white/5 space-y-3">
                      <Button variant="outline" className="w-full justify-center" onClick={handleContact}>
                        <i className="ri-mail-send-line mr-2"></i>Send Email
                      </Button>
                      <Button variant="outline" className="w-full justify-center" onClick={() => navigate(selectedRequest.type === 'Surrogate Application' ? `/surrogates/${selectedRequest.id}` : `/parents/${selectedRequest.id}`)}>
                        <i className="ri-user-settings-line mr-2"></i>View Full Profile
                      </Button>
                    </div>
                  </div>
                </Card>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-center p-8 bg-white/50 dark:bg-[#15111f]/50 rounded-2xl border-2 border-dashed border-rose-100 dark:border-white/5">
                  <div className="w-12 h-12 bg-rose-50 dark:bg-rose-500/10 rounded-full flex items-center justify-center mb-4">
                    <i className="ri-cursor-line text-rose-400"></i>
                  </div>
                  <p className="text-sm text-gray-500">Select a request from the list to view details and take actions.</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <RecordInquiryDialog 
        isOpen={isRecordDialogOpen}
        onClose={() => setIsRecordDialogOpen(false)}
        onSuccess={fetchRequests}
        type={inquiryType}
      />
    </div>
  );
};

export default RequestsPage;
