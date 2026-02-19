
import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';
import { inquiryService } from '../../services/inquiryService';
import type { User } from '../../types';

const InquiriesPage: React.FC = () => {
  const [inquiries, setInquiries] = useState<User[]>([]);
  const [viewStyle, setViewStyle] = useState<'grid' | 'table'>('table');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchInquiries();
  }, []);

  const fetchInquiries = async () => {
    setIsLoading(true);
    try {
      const data = await inquiryService.getNewInquiries();
      setInquiries(data);
    } catch (error) {
      console.error('Error fetching inquiries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async (userId: string, newStatus: string) => {
    if (!window.confirm(`Are you sure you want to move this inquiry to "${newStatus}"?`)) return;
    
    try {
      await inquiryService.updateInquiryStatus(userId, newStatus);
      fetchInquiries(); // Refresh list
    } catch (error) {
      alert('Failed to update status');
    }
  };

  const handeArchive = async (userId: string) => {
      if (!window.confirm('Are you sure you want to archive this inquiry?')) return;
      try {
          await inquiryService.archiveInquiry(userId);
          fetchInquiries();
      } catch (error) {
          alert('Failed to archive');
      }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">New Inquiries</h1>
              <p className="text-gray-600 dark:text-gray-400">Manage incoming Intended Parent leads.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                <button
                  onClick={() => setViewStyle('grid')}
                  className={`p-2 rounded-md transition-colors cursor-pointer ${
                    viewStyle === 'grid'
                      ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                  title="Grid View"
                >
                  <i className="ri-layout-grid-line text-lg"></i>
                </button>
                <button
                  onClick={() => setViewStyle('table')}
                  className={`p-2 rounded-md transition-colors cursor-pointer ${
                    viewStyle === 'table'
                      ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                  title="Table View"
                >
                  <i className="ri-table-line text-lg"></i>
                </button>
              </div>
              <Button variant="outline" onClick={fetchInquiries}>
                <i className="ri-refresh-line mr-2"></i>
                Refresh
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-48 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : inquiries.length === 0 ? (
            <Card className="p-12 text-center text-gray-500">
              No new inquiries found.
            </Card>
          ) : viewStyle === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {inquiries.map((user) => (
                <Card key={user.id} className="hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                        <i className="ri-user-follow-line text-blue-600 dark:text-blue-400"></i>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {user.firstName} {user.lastName}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          ID: {user.id.split('-')[0]}...
                        </p>
                      </div>
                    </div>
                    <Badge color="blue">{user.status as string}</Badge>
                  </div>

                  <div className="space-y-2 mb-6">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Email:</span>
                      <a href={`mailto:${user.email}`} className="text-blue-600 hover:underline truncate ml-2">
                        {user.email}
                      </a>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Received:</span>
                      <span className="text-gray-900 dark:text-white">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      color="green" 
                      className="flex-1"
                      onClick={() => handleStatusUpdate(user.id, 'Consultation Scheduled')}
                    >
                      <i className="ri-calendar-check-line mr-1"></i>
                      Schedule
                    </Button>
                    <Button 
                      size="sm" 
                      color="blue" 
                      className="flex-1"
                      onClick={() => handleStatusUpdate(user.id, 'Intake in Progress')}
                    >
                      <i className="ri-play-circle-line mr-1"></i>
                      Intake
                    </Button>
                    <Button 
                      size="sm" 
                      color="red" 
                      variant="outline"
                      onClick={() => handeArchive(user.id)}
                    >
                      <i className="ri-archive-line"></i>
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs uppercase">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Name</th>
                      <th className="px-6 py-3 font-semibold">Email</th>
                      <th className="px-6 py-3 font-semibold">Date Received</th>
                      <th className="px-6 py-3 font-semibold">Status</th>
                      <th className="px-6 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {inquiries.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {user.firstName} {user.lastName}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                          <a href={`mailto:${user.email}`} className="text-blue-600 hover:underline">
                            {user.email}
                          </a>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                          {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4">
                          <Badge color="blue">{user.status as string}</Badge>
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                           <Button 
                             size="sm" 
                             color="green" 
                             onClick={() => handleStatusUpdate(user.id, 'Consultation Scheduled')}
                           >
                             <i className="ri-calendar-check-line"></i>
                           </Button>
                           <Button 
                             size="sm" 
                             color="blue" 
                             onClick={() => handleStatusUpdate(user.id, 'Intake in Progress')}
                           >
                             <i className="ri-play-circle-line"></i>
                           </Button>
                           <Button 
                             size="sm" 
                             color="red" 
                             variant="outline"
                             onClick={() => handeArchive(user.id)}
                           >
                             <i className="ri-archive-line"></i>
                           </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
};

export default InquiriesPage;
