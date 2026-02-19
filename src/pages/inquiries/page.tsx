
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
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">New Inquiries</h1>
              <p className="text-gray-600 dark:text-gray-400">Manage incoming Intended Parent leads.</p>
            </div>
            <Button variant="outline" onClick={fetchInquiries}>
              <i className="ri-refresh-line mr-2"></i>
              Refresh
            </Button>
          </div>

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
                  {isLoading ? (
                    <tr><td colSpan={5} className="text-center py-8">Loading...</td></tr>
                  ) : inquiries.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-gray-500">No new inquiries found.</td></tr>
                  ) : (
                    inquiries.map((user) => (
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
};

export default InquiriesPage;
