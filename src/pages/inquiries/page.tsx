import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';
import { inquiryService } from '../../services/inquiryService';
import RecordInquiryDialog from '../../components/feature/RecordInquiryDialog';
import type { User } from '../../types';
import { formatMMDDYYYYOr } from '../../utils/dateFormat';

const INQUIRY_STATUSES = [
  'New Inquiry',
  'Reviewed',
  'Contacted',
  'Follow-Up',
  'Consultation Scheduled',
  'Intake in Progress',
  'Declined / Inactive'
];

const InquiriesPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const sourceParam = searchParams.get('source');
  
  const [inquiries, setInquiries] = useState<User[]>([]);
  const [filteredInquiries, setFilteredInquiries] = useState<User[]>([]);
  const [viewStyle, setViewStyle] = useState<'grid' | 'table'>('table');
  const [isLoading, setIsLoading] = useState(true);
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);

  useEffect(() => {
    fetchInquiries();
  }, []);

  useEffect(() => {
    let filtered = inquiries;
    
    if (sourceParam) {
      filtered = filtered.filter(inquiry => {
        const source = inquirySourceOf(inquiry).toLowerCase();
        if (sourceParam === 'online') {
          return source === 'online' || source === 'website' || source === 'app' || source === '—';
        }
        if (sourceParam === 'phone') {
          return source === 'phone' || source === 'manual' || source === 'call';
        }
        return true;
      });
    }

    const statusParam = searchParams.get('status');
    if (statusParam) {
      filtered = filtered.filter(inquiry => 
        (inquiry.status as string).toLowerCase() === statusParam.toLowerCase()
      );
    }
    
    setFilteredInquiries(filtered);
  }, [inquiries, sourceParam, searchParams]);

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
    try {
      await inquiryService.updateInquiryStatus(userId, newStatus);
      fetchInquiries(); // Refresh list
    } catch (error) {
      alert('Failed to update status');
    }
  };

  // Resolves the human-readable inquiry source for a user. Prefers the
  // dedicated `inquiry_source` column but falls back to `data.inquirySource`
  // for rows written before the column existed.
  const inquirySourceOf = (user: User): string => {
    const direct = (user as Record<string, unknown>).inquiry_source;
    if (typeof direct === 'string' && direct.trim()) return direct;
    const blob = (user as Record<string, unknown>).data as Record<string, unknown> | undefined;
    if (blob && typeof blob.inquirySource === 'string' && blob.inquirySource.trim()) {
      return blob.inquirySource;
    }
    return '—';
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

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'new':
      case 'pending':
      case 'new inquiry':
        return <Badge color="yellow">New</Badge>;
      case 'reviewed':
        return <Badge color="purple">Reviewed</Badge>;
      case 'contacted':
        return <Badge color="blue">Contacted</Badge>;
      case 'follow-up':
        return <Badge color="orange">Follow Up</Badge>;
      case 'consultation scheduled':
        return <Badge color="green">Scheduled</Badge>;
      case 'intake in progress':
        return <Badge color="indigo">Intake</Badge>;
      case 'declined / inactive':
        return <Badge color="red">Inactive</Badge>;
      default:
        return <Badge color="gray">{status}</Badge>;
    }
  };

  return (
    <div className="flex h-screen bg-[#fdf4f6] dark:bg-[#0e0b1a]">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {sourceParam === 'online' ? 'Online Inquiries' : sourceParam === 'phone' ? 'Phone Inquiries' : 'All Inquiries'}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Review and process new inbound leads.
              </p>
            </div>
            <div className="flex items-center gap-3">
               <div className="flex bg-white dark:bg-[#15111f] rounded-xl p-1 border border-rose-100/60 dark:border-white/5">
                 <button 
                   onClick={() => setViewStyle('table')}
                   className={`p-2 rounded-lg transition-all ${viewStyle === 'table' ? 'bg-rose-500 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                 >
                   <i className="ri-table-line text-lg"></i>
                 </button>
                 <button 
                   onClick={() => setViewStyle('grid')}
                   className={`p-2 rounded-lg transition-all ${viewStyle === 'grid' ? 'bg-rose-500 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                 >
                   <i className="ri-layout-grid-line text-lg"></i>
                 </button>
               </div>
               <Button color="blue" onClick={() => setIsRecordDialogOpen(true)}>
                 <i className="ri-add-line mr-2"></i> Record Inquiry
               </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <i className="ri-loader-4-line text-4xl animate-spin text-rose-500"></i>
            </div>
          ) : filteredInquiries.length === 0 ? (
            <Card className="p-12 text-center border-dashed border-2">
              <i className="ri-inbox-line text-4xl text-gray-300 mb-4"></i>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">No inquiries found</h3>
              <p className="text-sm text-gray-500 mt-1">Try adjusting your filters or source.</p>
            </Card>
          ) : viewStyle === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredInquiries.map((user) => (
                <Card key={user.id} className="hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 font-bold">
                        {user.firstName?.[0]}{user.lastName?.[0]}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">
                          {user.firstName} {user.lastName}
                        </h3>
                        <p className="text-[10px] text-gray-400 font-medium">
                          ID: {user.id.split('-')[0]}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(user.status as string)}
                  </div>

                  <div className="space-y-2 mb-6">
                    <div className="flex items-center gap-2 text-sm">
                      <i className="ri-mail-line text-gray-400"></i>
                      <a href={`mailto:${user.email}`} className="text-blue-600 hover:underline truncate">
                        {user.email}
                      </a>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <i className="ri-calendar-line text-gray-400"></i>
                      <span className="text-gray-600 dark:text-gray-400">
                        Received {formatMMDDYYYYOr(user.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-rose-50 dark:border-white/5 flex items-center justify-between">
                     <select 
                       className="text-xs font-semibold bg-rose-50/50 dark:bg-white/5 border-none rounded-lg focus:ring-rose-500 dark:text-white px-3 py-2 cursor-pointer"
                       value={user.status || 'New Inquiry'}
                       onChange={(e) => handleStatusUpdate(user.id, e.target.value)}
                     >
                        {INQUIRY_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                     </select>
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
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-rose-50/50 dark:bg-white/5 text-gray-600 dark:text-gray-400 text-[10px] uppercase tracking-widest font-black">
                    <tr>
                      <th className="px-6 py-4 font-bold">Name</th>
                      <th className="px-6 py-4 font-bold">Source</th>
                      <th className="px-6 py-4 font-bold">Received</th>
                      <th className="px-6 py-4 font-bold">Status</th>
                      <th className="px-6 py-4 font-bold text-right">Update Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {filteredInquiries.map((user) => (
                      <tr key={user.id} className="hover:bg-rose-50/20 dark:hover:bg-white/5 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900 dark:text-white">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-[10px] text-gray-400">{user.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge color="blue" variant="outline">{inquirySourceOf(user)}</Badge>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-400">
                          {formatMMDDYYYYOr(user.createdAt)}
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(user.status as string)}
                        </td>
                        <td className="px-6 py-4 text-right">
                           <div className="flex items-center justify-end gap-3">
                             <select 
                               className="text-xs font-semibold bg-rose-50/50 dark:bg-white/5 border-none rounded-lg focus:ring-rose-500 dark:text-white px-3 py-2 cursor-pointer transition-all hover:bg-rose-100/50 dark:hover:bg-white/10"
                               value={user.status || 'New Inquiry'}
                               onChange={(e) => handleStatusUpdate(user.id, e.target.value)}
                             >
                                {INQUIRY_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                             </select>
                             <button 
                               className="p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                               onClick={() => handeArchive(user.id)}
                               title="Archive Inquiry"
                             >
                               <i className="ri-delete-bin-line text-base"></i>
                             </button>
                           </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <RecordInquiryDialog
            isOpen={isRecordDialogOpen}
            onClose={() => setIsRecordDialogOpen(false)}
            onSuccess={fetchInquiries}
          />
        </main>
      </div>
    </div>
  );
};

export default InquiriesPage;
