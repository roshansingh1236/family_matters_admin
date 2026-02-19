import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';
import RecordInquiryDialog from '../../components/feature/RecordInquiryDialog';

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
          submittedDate: u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'
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

  const handleStatusUpdate = async (status: 'approved' | 'rejected') => {
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
      const { error } = await supabase
        .from('users')
        .update({
          role: 'inquiry',
          status: 'new',
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;
      navigate('/inquiries');
    } catch (error) {
       console.error("Error converting to inquiry:", error);
       alert("Failed to convert to inquiry.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const requestsByType = requests.filter(req => req.source === inquiryType);

  const filteredRequests = activeTab === 'all' 
    ? requestsByType 
    : requestsByType.filter(request => request.status === activeTab);

  const getCounts = (status: string) => {
    if (status === 'all') return requestsByType.length;
    return requestsByType.filter(r => r.status === status).length;
  };

  const statusRetreived = [
    { value: 'all', label: 'All Requests' },
    { value: 'pending', label: 'Pending' },
    { value: 'under-review', label: 'Under Review' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge color="yellow">Pending</Badge>;
      case 'under-review':
        return <Badge color="blue">Under Review</Badge>;
      case 'approved':
        return <Badge color="green">Approved</Badge>;
      case 'rejected':
        return <Badge color="red">Rejected</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)} />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Requests Management</h1>
              <p className="text-gray-600 dark:text-gray-400">Manage all incoming surrogacy applications and requests.</p>
            </div>
            <button
              onClick={() => setIsRecordDialogOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 w-fit shadow-sm"
            >
              <i className="ri-phone-line"></i>
              Record Phone Request
            </button>
          </div>

          <RecordInquiryDialog 
            isOpen={isRecordDialogOpen} 
            onClose={() => setIsRecordDialogOpen(false)} 
            onSuccess={() => setInquiryType('phone')}
            variant="detailed"
          />

          {/* Top Level Tabs */}
          <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex space-x-8">
              <button
                onClick={() => {
                   setInquiryType('online');
                   setActiveTab('all');
                }}
                className={`pb-4 px-2 text-sm font-medium transition-colors cursor-pointer relative ${
                  inquiryType === 'online'
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Online Inquiries
                {inquiryType === 'online' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
                )}
              </button>
              <button
                 onClick={() => {
                  setInquiryType('phone');
                  setActiveTab('all');
               }}
                className={`pb-4 px-2 text-sm font-medium transition-colors cursor-pointer relative ${
                  inquiryType === 'phone'
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Phone Inquiries
                 {inquiryType === 'phone' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
                )}
              </button>
            </div>
          </div>

          {/* Status Tabs */}
          <div className="mb-6">
            <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
              {statusRetreived.map((status) => (
                <button
                  key={status.value}
                  onClick={() => setActiveTab(status.value)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    activeTab === status.value
                      ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {status.label} ({getCounts(status.value)})
                </button>
              ))}
            </div>
          </div>

          {/* Requests Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-64 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredRequests.map((request) => (
                <Card key={request.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setSelectedRequest(request)}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                        <i className="ri-user-line text-blue-600 dark:text-blue-400 text-lg"></i>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{request.applicantName}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{request.type}</p>
                      </div>
                    </div>
                    {getStatusBadge(request.status)}
                  </div>
  
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Age:</span>
                      <span className="text-gray-900 dark:text-white">{request.age}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Location:</span>
                      <span className="text-gray-900 dark:text-white">{request.location}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Experience:</span>
                      <span className="text-gray-900 dark:text-white">{request.experience}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Submitted:</span>
                      <span className="text-gray-900 dark:text-white">{request.submittedDate}</span>
                    </div>
                  </div>
  
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1">
                      <i className="ri-eye-line mr-1"></i>
                      View Details
                    </Button>
                    {request.status === 'pending' && (
                      <Button size="sm" color="green" onClick={(e) => {
                        e.stopPropagation();
                        // Optimistically or quickly approve without opening modal if desired, but for now just let it open modal or handle here. 
                        // The user request was about the modal actions, but let's leave this button as is or hook it up if needed.
                        // For safety, let's just let it open the modal via the card click found on the parent.
                      }}>
                        <i className="ri-check-line"></i>
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Request Detail Modal */}
          {selectedRequest && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Request Details</h2>
                    <button
                      onClick={() => setSelectedRequest(null)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
                    >
                      <i className="ri-close-line text-gray-600 dark:text-gray-400"></i>
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                        <i className="ri-user-line text-blue-600 dark:text-blue-400 text-2xl"></i>
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{selectedRequest.applicantName}</h3>
                        <p className="text-gray-600 dark:text-gray-400">{selectedRequest.type}</p>
                        {getStatusBadge(selectedRequest.status)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Age</label>
                        <p className="text-gray-900 dark:text-white">{selectedRequest.age || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Location</label>
                        <p className="text-gray-900 dark:text-white">{selectedRequest.location || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Experience</label>
                        <p className="text-gray-900 dark:text-white">{selectedRequest.experience || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Submitted Date</label>
                        <p className="text-gray-900 dark:text-white">{selectedRequest.submittedDate}</p>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Contact Information</label>
                      <div className="mt-2 space-y-1">
                        <p className="text-gray-900 dark:text-white">Email: {selectedRequest.email}</p>
                        <p className="text-gray-900 dark:text-white">Phone: {selectedRequest.phone}</p>
                      </div>
                    </div>
                    
                    {/* Render message/notes if available */}
                    {selectedRequest.message && (
                        <div>
                        <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Notes / Message</label>
                        <p className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 p-3 rounded mt-2">{selectedRequest.message}</p>
                        </div>
                    )}

                    <div className="flex gap-3">
                         <Button 
                            color="green" 
                            className="flex-1"
                            onClick={() => handleStatusUpdate('approved')}
                            disabled={isActionLoading || selectedRequest.status === 'approved'}
                         >
                        {isActionLoading ? <i className="ri-loader-4-line animate-spin mr-2"></i> : <i className="ri-check-line mr-2"></i>}
                        Approve
                      </Button>
                      <Button 
                        color="red" 
                        className="flex-1"
                        onClick={() => handleStatusUpdate('rejected')}
                        disabled={isActionLoading || selectedRequest.status === 'rejected'}
                      >
                         {isActionLoading ? <i className="ri-loader-4-line animate-spin mr-2"></i> : <i className="ri-close-line mr-2"></i>}
                        Reject
                      </Button>
                      <Button variant="outline" className="flex-1" onClick={handleContact}>
                        <i className="ri-message-line mr-2"></i>
                        Contact
                      </Button>
                      <Button 
                        variant="outline" 
                        className="flex-1" 
                        onClick={handleConvertToInquiry}
                        disabled={isActionLoading}
                      >
                         {isActionLoading ? <i className="ri-loader-4-line animate-spin mr-2"></i> : <i className="ri-share-forward-line mr-2"></i>}
                        Convert to Inquiry
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

export default RequestsPage;
