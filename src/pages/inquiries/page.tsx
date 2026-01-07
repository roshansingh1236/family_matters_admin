import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Badge from '../../components/base/Badge';
import RecordInquiryDialog from '../../components/feature/RecordInquiryDialog';

interface Inquiry {
  id: string;
  name: string;
  type: 'online' | 'phone';
  email: string;
  phone: string;
  message: string;
  date: string;
  status: string;
  fullData?: any;
}

const InquiriesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'online' | 'phone'>('online');
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedInquiries = snapshot.docs.map(doc => {
        const data = doc.data();
        const formData = data.formData || {};
        
        // Determine type based on source or default to online
        const type = (data.source === 'phone') ? 'phone' : 'online';
        
        // Construct date string
        let dateStr = 'Recently';
        if (data.createdAt) {
          if (data.createdAt instanceof Timestamp) {
            dateStr = data.createdAt.toDate().toLocaleDateString();
          } else if (typeof data.createdAt === 'string') {
             // Try to parse string date if valid
             const d = new Date(data.createdAt);
             if (!isNaN(d.getTime())) {
               dateStr = d.toLocaleDateString();
             } else {
                dateStr = data.createdAt;
             }
          }
        }

        // Construct name
        const name = data.displayName || 
                     (data.firstName && data.lastName ? `${data.firstName} ${data.lastName}` : '') ||
                     (formData.firstName && formData.lastName ? `${formData.firstName} ${formData.lastName}` : '') ||
                     data.email || 
                     'Unknown User';

        return {
          id: doc.id,
          name: name,
          type: type as 'online' | 'phone',
          email: data.email || formData.email || 'No email provided',
          phone: data.phone || formData.phone || 'No phone provided',
          message: data.message || formData.message || 'No message content',
          date: dateStr,
          status: data.status || 'new',
          fullData: data
        };
      });

      setInquiries(fetchedInquiries);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching inquiries:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredInquiries = inquiries.filter(inquiry => inquiry.type === activeTab);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return <Badge color="blue">New</Badge>;
      case 'in-progress':
        return <Badge color="yellow">In Progress</Badge>;
      case 'closed':
        return <Badge color="green">Closed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Inquiries</h1>
              <p className="text-gray-600 dark:text-gray-400">Manage online and phone inquiries.</p>
            </div>
            <button
              onClick={() => setIsRecordDialogOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 w-fit shadow-sm"
            >
              <i className="ri-phone-line"></i>
              Record Phone Inquiry
            </button>
          </div>

          <RecordInquiryDialog 
            isOpen={isRecordDialogOpen} 
            onClose={() => setIsRecordDialogOpen(false)} 
            onSuccess={() => setActiveTab('phone')}
          />

          {/* Type Tabs */}
          <div className="mb-6">
            <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
              <button
                onClick={() => setActiveTab('online')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'online'
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Online Inquiries
              </button>
              <button
                onClick={() => setActiveTab('phone')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'phone'
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Phone Inquiries
              </button>
            </div>
          </div>

          {loading ? (
             <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
               {[1, 2, 3].map((n) => (
                 <div key={n} className="h-48 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>
               ))}
             </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredInquiries.map((inquiry) => (
                <Card
                  key={inquiry.id}
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => setSelectedInquiry(inquiry)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        inquiry.type === 'online' ? 'bg-purple-100 dark:bg-purple-900' : 'bg-green-100 dark:bg-green-900'
                      }`}>
                        <i className={`${
                          inquiry.type === 'online' ? 'ri-global-line text-purple-600 dark:text-purple-400' : 'ri-phone-line text-green-600 dark:text-green-400'
                        } text-lg`}></i>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{inquiry.name}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">{inquiry.type}</p>
                      </div>
                    </div>
                    {getStatusBadge(inquiry.status)}
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Date:</span>
                      <span className="text-gray-900 dark:text-white">{inquiry.date}</span>
                    </div>
                     <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Email:</span>
                      <span className="text-gray-900 dark:text-white">{inquiry.email}</span>
                    </div>
                     <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Phone:</span>
                      <span className="text-gray-900 dark:text-white">{inquiry.phone}</span>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-4">
                    {inquiry.message}
                  </p>
                </Card>
              ))}
              {filteredInquiries.length === 0 && (
                  <div className="col-span-full text-center py-10 text-gray-500 dark:text-gray-400">
                      No {activeTab} inquiries found.
                  </div>
              )}
            </div>
          )}

          {/* Detail Modal */}
          {selectedInquiry && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Inquiry Details</h2>
                    <button
                      onClick={() => setSelectedInquiry(null)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
                    >
                      <i className="ri-close-line text-gray-600 dark:text-gray-400"></i>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-4 mb-6">
                         <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                            selectedInquiry.type === 'online' ? 'bg-purple-100 dark:bg-purple-900' : 'bg-green-100 dark:bg-green-900'
                            }`}>
                            <i className={`${
                                selectedInquiry.type === 'online' ? 'ri-global-line text-purple-600 dark:text-purple-400' : 'ri-phone-line text-green-600 dark:text-green-400'
                            } text-2xl`}></i>
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{selectedInquiry.name}</h3>
                            <p className="text-gray-600 dark:text-gray-400">{selectedInquiry.email}</p>
                             {getStatusBadge(selectedInquiry.status)}
                        </div>
                    </div>
                    
                    <div>
                        <h4 className="font-medium text-gray-900 dark:text-white mb-2">Message</h4>
                        <p className="text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                            {selectedInquiry.message}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                             <span className="text-gray-600 dark:text-gray-400 block text-sm">Phone</span>
                             <span className="text-gray-900 dark:text-white">{selectedInquiry.phone}</span>
                        </div>
                         <div>
                             <span className="text-gray-600 dark:text-gray-400 block text-sm">Date</span>
                             <span className="text-gray-900 dark:text-white">{selectedInquiry.date}</span>
                        </div>
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

export default InquiriesPage;
