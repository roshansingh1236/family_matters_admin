import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';
import { supabase } from '../../lib/supabase';
import type { User, UserStatus } from '../../types';
import { GC_STATUSES } from '../../types';
import AddUserDialog from '../../components/feature/AddUserDialog';
import { formatMMDDYYYY } from '../../utils/dateFormat';
import { approvalSyncFields } from '../../utils/approvalStatus';

const SurrogatesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [surrogates, setSurrogates] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [viewStyle, setViewStyle] = useState<'grid' | 'table'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const activeStatus = searchParams.get('status');

  useEffect(() => {
    if (activeStatus) setStatusFilter(activeStatus);
  }, [activeStatus]);

  const fetchSurrogates = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'Surrogate')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSurrogates(data || []);
    } catch (error) {
      console.error('Error fetching surrogates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSurrogates();
  }, []);

  const getDisplayName = (user: User) => {
    const first = user.firstName || user.first_name || '';
    const last = user.lastName || user.last_name || '';
    const combined = [first, last].filter(Boolean).join(' ');
    return combined || user.email || 'Anonymous Surrogate';
  };

  const filteredSurrogates = useMemo(() => {
    let list = surrogates;

    if (statusFilter !== 'all') {
      list = list.filter(s => (s.status as string).toLowerCase() === statusFilter.toLowerCase());
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => 
        getDisplayName(s).toLowerCase().includes(q) || 
        (s.email && s.email.toLowerCase().includes(q))
      );
    }

    list = [...list].sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = getDisplayName(a).localeCompare(getDisplayName(b));
      } else if (sortBy === 'date') {
        comparison = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      } else if (sortBy === 'status') {
        comparison = (a.status as string || '').localeCompare(b.status as string || '');
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return list;
  }, [surrogates, statusFilter, searchQuery, sortBy, sortOrder]);

  const handleStatusUpdate = async (userId: string, newStatus: UserStatus) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: newStatus, ...approvalSyncFields(newStatus), updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) throw error;
      fetchSurrogates();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    }
  };

  const handeArchive = async (userId: string) => {
    if (!window.confirm('Are you sure you want to archive this surrogate?')) return;
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: 'Declined / Inactive', updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (error) throw error;
      fetchSurrogates();
    } catch (error) {
      console.error('Error archiving user:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase();
    if (s === 'matched' || s === 'ready to match' || s === 'accepted to program') return <Badge color="green">{status}</Badge>;
    if (s?.includes('new') || s === 'contacted') return <Badge color="blue">{status}</Badge>;
    if (s?.includes('pending') || s?.includes('scheduled')) return <Badge color="yellow">{status}</Badge>;
    if (s === 'declined / inactive' || s === 'on hold') return <Badge color="red">{status}</Badge>;
    return <Badge color="gray">{status}</Badge>;
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-[#0e0b1a]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Surrogates Dashboard</h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm font-medium">Manage gestational carrier applications and active journeys.</p>
            </div>
            
            <div className="flex items-center gap-3">
               <div className="flex bg-white dark:bg-white/5 p-1 rounded-xl border border-rose-100/50 dark:border-white/10">
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
               <Button color="blue" onClick={() => setIsAddDialogOpen(true)}>
                 <i className="ri-add-line mr-2"></i> Add Surrogate
               </Button>
            </div>
          </div>

          <div className="bg-white dark:bg-white/5 p-4 rounded-2xl border border-rose-100/50 dark:border-white/10 mb-6 flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input 
                type="text" 
                placeholder="Search by name or email..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-[#0e0b1a] border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none text-sm dark:text-white transition-all"
              />
            </div>
            <div className="flex gap-2">
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 bg-gray-50 dark:bg-[#0e0b1a] border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none text-sm dark:text-white"
              >
                <option value="all">All Statuses</option>
                {GC_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-2 bg-gray-50 dark:bg-[#0e0b1a] border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none text-sm dark:text-white"
              >
                <option value="date">Sort by Date</option>
                <option value="name">Sort by Name</option>
                <option value="status">Sort by Status</option>
              </select>
              <button 
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="px-3 py-2 bg-gray-50 dark:bg-[#0e0b1a] border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-gray-600 dark:text-gray-300 flex items-center justify-center"
                title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
              >
                <i className={sortOrder === 'asc' ? 'ri-sort-asc' : 'ri-sort-desc'}></i>
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <i className="ri-loader-4-line text-4xl animate-spin text-rose-500"></i>
            </div>
          ) : filteredSurrogates.length === 0 ? (
            <Card className="p-12 text-center border-dashed border-2">
              <i className="ri-user-heart-line text-4xl text-gray-300 mb-4"></i>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">No surrogates found</h3>
              <p className="text-sm text-gray-500 mt-1">No surrogates are currently registered with this filter.</p>
            </Card>
          ) : viewStyle === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredSurrogates.map((user) => (
                <Card key={user.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/surrogates/${user.id}`)}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 font-bold">
                        {getDisplayName(user)[0]}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">{getDisplayName(user)}</h3>
                        <p className="text-[10px] text-gray-400 font-medium">ID: {user.id.split('-')[0]}</p>
                      </div>
                    </div>
                    {getStatusBadge(user.status as string)}
                  </div>

                  <div className="space-y-2 mb-6">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <i className="ri-mail-line text-gray-400"></i>
                      <span className="truncate">{user.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <i className="ri-calendar-line text-gray-400"></i>
                      <span>Joined {formatMMDDYYYY(user.createdAt)}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-rose-50 dark:border-white/5 flex items-center justify-between" onClick={e => e.stopPropagation()}>
                     <select 
                       className="text-xs font-semibold bg-rose-50/50 dark:bg-white/5 border-none rounded-lg focus:ring-rose-500 dark:text-white px-3 py-2 cursor-pointer"
                       value={user.status || 'New Application'}
                       onChange={(e) => handleStatusUpdate(user.id, e.target.value as UserStatus)}
                     >
                        {GC_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                     </select>
                     <Button size="sm" color="red" variant="outline" onClick={() => handeArchive(user.id)}>
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
                  <thead className="text-gray-600 dark:text-gray-400 text-[10px] uppercase tracking-widest font-black">
                    <tr className="bg-rose-50/50 dark:bg-white/5">
                      <th className="px-6 py-4 font-bold rounded-l-xl">Name</th>
                      <th className="px-6 py-4 font-bold">Received</th>
                      <th className="px-6 py-4 font-bold">Status</th>
                      <th className="px-6 py-4 font-bold text-right rounded-r-xl">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {filteredSurrogates.map((user) => (
                      <tr key={user.id} className="hover:bg-rose-50/20 dark:hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => navigate(`/surrogates/${user.id}`)}>
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900 dark:text-white">{getDisplayName(user)}</div>
                          <div className="text-[10px] text-gray-400">{user.email}</div>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-400">
                          {formatMMDDYYYY(user.createdAt)}
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(user.status as string)}
                        </td>
                        <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                           <div className="flex items-center justify-end gap-3">
                             <select 
                               className="text-xs font-semibold bg-rose-50/50 dark:bg-white/5 border-none rounded-lg focus:ring-rose-500 dark:text-white px-3 py-2 cursor-pointer"
                               value={user.status || 'New Application'}
                               onChange={(e) => handleStatusUpdate(user.id, e.target.value as UserStatus)}
                             >
                                {GC_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                             </select>
                             <button className="p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100" onClick={() => handeArchive(user.id)}>
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
        </main>
      </div>

      <AddUserDialog
        isOpen={isAddDialogOpen}
        role="Surrogate"
        onClose={() => setIsAddDialogOpen(false)}
        onSuccess={fetchSurrogates}
      />
    </div>
  );
};

export default SurrogatesPage;
