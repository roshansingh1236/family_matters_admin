
import React, { useState } from 'react';
import { allRequests, requestStatuses } from '../../mocks/requestsData';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';

const RequestsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const filteredRequests = activeTab === 'all' 
    ? allRequests 
    : allRequests.filter(request => request.status === activeTab);

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
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Requests Management</h1>
            <p className="text-gray-600 dark:text-gray-400">Manage all incoming surrogacy applications and requests.</p>
          </div>

          {/* Status Tabs */}
          <div className="mb-6">
            <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
              {requestStatuses.map((status) => (
                <button
                  key={status.value}
                  onClick={() => setActiveTab(status.value)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    activeTab === status.value
                      ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {status.label} ({status.count})
                </button>
              ))}
            </div>
          </div>

          {/* Requests Grid */}
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
                    <Button size="sm" color="green">
                      <i className="ri-check-line"></i>
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>

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
                        <p className="text-gray-900 dark:text-white">{selectedRequest.age}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Location</label>
                        <p className="text-gray-900 dark:text-white">{selectedRequest.location}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Experience</label>
                        <p className="text-gray-900 dark:text-white">{selectedRequest.experience}</p>
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

                    <div className="flex gap-3">
                      <Button color="green" className="flex-1">
                        <i className="ri-check-line mr-2"></i>
                        Approve
                      </Button>
                      <Button color="red" className="flex-1">
                        <i className="ri-close-line mr-2"></i>
                        Reject
                      </Button>
                      <Button variant="outline" className="flex-1">
                        <i className="ri-message-line mr-2"></i>
                        Contact
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
