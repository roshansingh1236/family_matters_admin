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
  const [searchParams, setSearchParams] = useSearchParams();
  const sourceParam = searchParams.get('source');
  // Per client review: declined/inactive inquiries are archived. Show only
  // when the admin opts in via ?archived=1.
  const showArchived = searchParams.get('archived') === '1';

  const [inquiries, setInquiries] = useState<User[]>([]);
  const [archivedInquiries, setArchivedInquiries] = useState<User[]>([]);
  const [surrogateInquiries, setSurrogateInquiries] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'parents' | 'surrogates'>('parents');
  const [filteredInquiries, setFilteredInquiries] = useState<User[]>([]);
  const [filteredSurrogateInquiries, setFilteredSurrogateInquiries] = useState<any[]>([]);
  const [viewStyle, setViewStyle] = useState<'grid' | 'table'>('table');
  const [isLoading, setIsLoading] = useState(true);
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);

  useEffect(() => {
    fetchInquiries();
  }, []);

  useEffect(() => {
    let filteredParents = showArchived ? archivedInquiries : inquiries;
    if (sourceParam) {
      filteredParents = filteredParents.filter(inquiry => {
        const source = inquirySourceOf(inquiry).toLowerCase();
        if (sourceParam === 'online') return source === 'online' || source === 'website' || source === 'app' || source === '—';
        if (sourceParam === 'phone') return source === 'phone' || source === 'manual' || source === 'call';
        if (sourceParam === 'app') return source === 'app' || source === 'mobile';
        return true;
      });
    }
    const statusParam = searchParams.get('status');
    if (statusParam) {
      filteredParents = filteredParents.filter(inquiry =>
        (inquiry.status as string).toLowerCase() === statusParam.toLowerCase()
      );
    }
    setFilteredInquiries(filteredParents);

    let filteredSurrogates = surrogateInquiries;
    if (statusParam) {
      filteredSurrogates = filteredSurrogates.filter(inquiry =>
        (inquiry.status as string).toLowerCase() === statusParam.toLowerCase()
      );
    }
    setFilteredSurrogateInquiries(filteredSurrogates);
  }, [inquiries, archivedInquiries, surrogateInquiries, sourceParam, searchParams, showArchived]);

  const fetchInquiries = async () => {
    setIsLoading(true);
    try {
      const [parents, archived, surrogates] = await Promise.all([
        inquiryService.getNewInquiries(),
        inquiryService.getArchivedInquiries(),
        inquiryService.getSurrogateInquiries()
      ]);
      setInquiries(parents);
      setArchivedInquiries(archived);
      setSurrogateInquiries(surrogates);
    } catch (error) {
      console.error('Error fetching inquiries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (userId: string) => {
    if (!window.confirm('Restore this archived inquiry?')) return;
    try {
      await inquiryService.restoreInquiry(userId);
      fetchInquiries();
    } catch (error) {
      console.error('Error restoring inquiry:', error);
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
  // dedicated `inquiry_source` column but falls back to `data.inquirySource`,
  // `form_data.inquirySource`, or `form_data.source` for rows written before
  // the column existed. App signups set source = "App".
  const inquirySourceOf = (user: User): string => {
    const u = user as Record<string, unknown>;
    const direct = u.inquiry_source;
    if (typeof direct === 'string' && direct.trim()) return direct;
    const blob = u.data as Record<string, unknown> | undefined;
    if (blob && typeof blob.inquirySource === 'string' && blob.inquirySource.trim()) {
      return blob.inquirySource;
    }
    const fd = u.form_data as Record<string, unknown> | undefined;
    if (fd) {
      if (typeof fd.inquirySource === 'string' && (fd.inquirySource as string).trim()) {
        return fd.inquirySource as string;
      }
      if (typeof fd.source === 'string' && (fd.source as string).trim()) {
        return fd.source as string;
      }
    }
    // If this user signed up through the app, we won't have a source yet.
    // Default to "App" so the inquiry list reveals where it came from.
    return 'App';
  };

  const handleArchive = async (userId: string) => {
      if (!window.confirm('Are you sure you want to archive this inquiry?')) return;
      try {
          await inquiryService.archiveInquiry(userId);
          fetchInquiries();
      } catch (error) {
          console.error('Error archiving:', error);
      }
  };

  const handleConvertToProfile = async (inquiry: any) => {
    if (!window.confirm(`Convert ${inquiry.first_name} ${inquiry.last_name} to a full profile?`)) return;
    try {
      await inquiryService.convertSurrogateToProfile(inquiry);
      fetchInquiries();
    } catch (error) {
      console.error('Error converting:', error);
      alert('Failed to convert inquiry. The email might already be registered.');
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
                {showArchived ? 'Archived Inquiries' : (sourceParam === 'online' ? 'Online Inquiries' : sourceParam === 'phone' ? 'Phone Inquiries' : sourceParam === 'app' ? 'App Inquiries' : 'All Inquiries')}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {showArchived
                  ? 'Declined / Inactive — restore by changing status back, or by clicking Restore.'
                  : 'Review and process new inbound leads. Sources include web form, mobile app, and phone (manual entry).'}
              </p>
            </div>
            <button
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                if (showArchived) next.delete('archived');
                else next.set('archived', '1');
                setSearchParams(next);
              }}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${showArchived
                ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                : 'bg-white dark:bg-white/5 text-gray-700 dark:text-gray-200 border-rose-100/50 dark:border-white/10 hover:border-rose-200'}`}
            >
              <i className={`${showArchived ? 'ri-arrow-go-back-line' : 'ri-archive-line'} mr-1`}></i>
              {showArchived ? 'Back to Active' : 'View Archived'}
            </button>
          </div>

          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex bg-white dark:bg-[#15111f] p-1 rounded-2xl border border-rose-100/60 dark:border-white/5 shadow-sm">
                <button 
                  onClick={() => setActiveTab('parents')}
                  className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'parents' ? 'bg-rose-500 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Intended Parents
                </button>
                <button 
                  onClick={() => setActiveTab('surrogates')}
                  className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'surrogates' ? 'bg-rose-500 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Surrogates
                </button>
            </div>
            <div className="flex items-center gap-3">
               <div className="flex bg-white dark:bg-[#15111f] rounded-xl p-1 border border-rose-100/60 dark:border-white/5">
                 <button 
                   onClick={() => setViewStyle('table')}
                   className={`p-2 rounded-lg transition-all ${viewStyle === 'table' ? 'bg-gray-100 dark:bg-white/10 text-rose-500' : 'text-gray-400 hover:text-gray-600'}`}
                 >
                   <i className="ri-table-line text-lg"></i>
                 </button>
                 <button 
                   onClick={() => setViewStyle('grid')}
                   className={`p-2 rounded-lg transition-all ${viewStyle === 'grid' ? 'bg-gray-100 dark:bg-white/10 text-rose-500' : 'text-gray-400 hover:text-gray-600'}`}
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
          ) : (activeTab === 'parents' ? filteredInquiries : filteredSurrogateInquiries).length === 0 ? (
            <Card className="p-12 text-center border-dashed border-2">
              <i className="ri-inbox-line text-4xl text-gray-300 mb-4"></i>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">No inquiries found</h3>
              <p className="text-sm text-gray-500 mt-1">Try adjusting your filters or source.</p>
            </Card>
          ) : viewStyle === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {(activeTab === 'parents' ? filteredInquiries : (filteredSurrogateInquiries as any[])).map((item) => (
                <Card key={item.id} className="hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 font-bold">
                        {(item.firstName || item.first_name)?.[0]}{(item.lastName || item.last_name)?.[0]}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">
                          {item.firstName || item.first_name} {item.lastName || item.last_name}
                        </h3>
                        <p className="text-[10px] text-gray-400 font-medium">
                          ID: {String(item.id).split('-')[0]}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(item.status as string)}
                  </div>

                  <div className="space-y-2 mb-6">
                    <div className="flex items-center gap-2 text-sm">
                      <i className="ri-mail-line text-gray-400"></i>
                      <a href={`mailto:${item.email}`} className="text-blue-600 hover:underline truncate">
                        {item.email}
                      </a>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <i className="ri-calendar-line text-gray-400"></i>
                      <span className="text-gray-600 dark:text-gray-400">
                        Received {formatMMDDYYYYOr(item.createdAt || item.created_at)}
                      </span>
                    </div>
                    {activeTab === 'surrogates' && item.state && (
                      <div className="flex items-center gap-2 text-sm">
                        <i className="ri-map-pin-line text-gray-400"></i>
                        <span className="text-gray-600 dark:text-gray-400">{item.state}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-rose-50 dark:border-white/5 flex items-center justify-between">
                     <select 
                       className="text-xs font-semibold bg-rose-50/50 dark:bg-white/5 border-none rounded-lg focus:ring-rose-500 dark:text-white px-3 py-2 cursor-pointer"
                       value={item.status || (activeTab === 'parents' ? 'New Inquiry' : 'pending')}
                       onChange={(e) => {
                         if (activeTab === 'parents') handleStatusUpdate(item.id, e.target.value);
                         else {
                            inquiryService.updateSurrogateInquiryStatus(item.id, e.target.value).then(() => fetchInquiries());
                         }
                       }}
                     >
                        {(activeTab === 'parents' ? INQUIRY_STATUSES : ['pending', 'reviewed', 'contacted', 'declined', 'converted']).map(s => <option key={s} value={s}>{s}</option>)}
                     </select>
                     
                     <div className="flex gap-2">
                        {activeTab === 'surrogates' && item.status !== 'converted' && (
                          <Button size="sm" color="emerald" onClick={() => handleConvertToProfile(item)}>
                            Convert
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          color="red" 
                          variant="outline"
                          onClick={() => activeTab === 'parents' ? handleArchive(item.id) : alert('Archive not implemented for surrogate inquiries')}
                        >
                          <i className="ri-archive-line"></i>
                        </Button>
                     </div>
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
                      <th className="px-6 py-4 font-bold">{activeTab === 'parents' ? 'Source' : 'State'}</th>
                      <th className="px-6 py-4 font-bold">Received</th>
                      <th className="px-6 py-4 font-bold">Status</th>
                      <th className="px-6 py-4 font-bold text-right">Update Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {(activeTab === 'parents' ? filteredInquiries : (filteredSurrogateInquiries as any[])).map((item) => (
                      <tr key={item.id} className="hover:bg-rose-50/20 dark:hover:bg-white/5 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900 dark:text-white">
                            {item.firstName || item.first_name} {item.lastName || item.last_name}
                          </div>
                          <div className="text-[10px] text-gray-400">{item.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          {activeTab === 'parents' ? (
                             <Badge color="blue" variant="outline">{inquirySourceOf(item)}</Badge>
                          ) : (
                             <span className="text-xs font-medium">{item.state || '—'}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-400">
                          {formatMMDDYYYYOr(item.createdAt || item.created_at)}
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(item.status as string)}
                        </td>
                        <td className="px-6 py-4 text-right">
                           <div className="flex items-center justify-end gap-3">
                             {activeTab === 'surrogates' && item.status !== 'converted' && (
                               <Button size="xs" color="emerald" onClick={() => handleConvertToProfile(item)}>
                                 Convert
                               </Button>
                             )}
                             <select 
                               className="text-xs font-semibold bg-rose-50/50 dark:bg-white/5 border-none rounded-lg focus:ring-rose-500 dark:text-white px-3 py-2 cursor-pointer transition-all hover:bg-rose-100/50 dark:hover:bg-white/10"
                               value={item.status || (activeTab === 'parents' ? 'New Inquiry' : 'pending')}
                               onChange={(e) => {
                                  if (activeTab === 'parents') handleStatusUpdate(item.id, e.target.value);
                                  else {
                                     inquiryService.updateSurrogateInquiryStatus(item.id, e.target.value).then(() => fetchInquiries());
                                  }
                               }}
                             >
                                {(activeTab === 'parents' ? INQUIRY_STATUSES : ['pending', 'reviewed', 'contacted', 'declined', 'converted']).map(s => <option key={s} value={s}>{s}</option>)}
                             </select>
                             {showArchived && activeTab === 'parents' ? (
                               <button
                                 className="p-2 text-emerald-500 hover:text-emerald-700 transition-colors"
                                 onClick={() => handleRestore(item.id)}
                                 title="Restore from Archive"
                               >
                                 <i className="ri-arrow-go-back-line text-base"></i>
                               </button>
                             ) : (
                               <button
                                 className="p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                 onClick={() => activeTab === 'parents' ? handleArchive(item.id) : alert('Archive not implemented')}
                                 title="Archive Inquiry"
                               >
                                 <i className="ri-delete-bin-line text-base"></i>
                               </button>
                             )}
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
