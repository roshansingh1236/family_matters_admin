import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';
import { supabase } from '../../lib/supabase';
import type { User, UserStatus } from '../../types';
import { IP_STATUSES } from '../../types';
import AddUserDialog from '../../components/feature/AddUserDialog';
import { formatMMDDYYYY } from '../../utils/dateFormat';

const ParentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [parents, setParents] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [viewStyle, setViewStyle] = useState<'grid' | 'table'>('table');

  const activeStatus = searchParams.get('status');
  // Per client review: declined/inactive IPs are archived. Show only when the
  // user explicitly opts in via the "archived=1" query param.
  const showArchived = searchParams.get('archived') === '1';

  const fetchParents = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'Intended Parent')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setParents(data || []);
    } catch (error) {
      console.error('Error fetching parents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchParents();
  }, []);

  const filteredParents = useMemo(() => {
    let list = parents;
    // Default view hides archived rows. Archived view shows ONLY them.
    if (showArchived) {
      list = list.filter(p => (p.status as string)?.toLowerCase() === 'declined / inactive');
    } else {
      list = list.filter(p => (p.status as string)?.toLowerCase() !== 'declined / inactive');
    }
    if (activeStatus) {
      list = list.filter(p => (p.status as string).toLowerCase() === activeStatus.toLowerCase());
    }
    return list;
  }, [parents, activeStatus, showArchived]);

  const handleStatusUpdate = async (userId: string, newStatus: UserStatus) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) throw error;
      fetchParents();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    }
  };

  const handeArchive = async (userId: string) => {
    if (!window.confirm('Are you sure you want to archive this user?')) return;
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: 'Declined / Inactive', updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (error) throw error;
      fetchParents();
    } catch (error) {
      console.error('Error archiving user:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase();
    if (s === 'matched' || s === 'accepted to program') return <Badge color="green">{status}</Badge>;
    if (s === 'inquiry' || s === 'new inquiry') return <Badge color="blue">{status}</Badge>;
    if (s?.includes('pending')) return <Badge color="yellow">{status}</Badge>;
    if (s === 'declined / inactive' || s === 'on hold') return <Badge color="red">{status}</Badge>;
    return <Badge color="gray">{status}</Badge>;
  };

  const getDisplayName = (user: User) => {
    const first = user.firstName || user.first_name || '';
    const last = user.lastName || user.last_name || '';
    const combined = [first, last].filter(Boolean).join(' ');
    return combined || user.email || 'Anonymous IP';
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-[#0e0b1a]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                {showArchived ? 'Archived Intended Parents' : 'Intended Parents Dashboard'}
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm font-medium">
                {showArchived
                  ? 'Declined / Inactive parents — restored when status is changed to anything else.'
                  : 'Manage family building inquiries and active journeys.'}
              </p>
            </div>

            <div className="flex items-center gap-3">
               <button
                 onClick={() => navigate(showArchived ? '/parents' : '/parents?archived=1')}
                 className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${showArchived
                   ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                   : 'bg-white dark:bg-white/5 text-gray-700 dark:text-gray-200 border-rose-100/50 dark:border-white/10 hover:border-rose-200'}`}
               >
                 <i className={`${showArchived ? 'ri-arrow-go-back-line' : 'ri-archive-line'} mr-1`}></i>
                 {showArchived ? 'Back to Active' : 'View Archived'}
               </button>
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
                 <i className="ri-add-line mr-2"></i> Add Parent
               </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <i className="ri-loader-4-line text-4xl animate-spin text-rose-500"></i>
            </div>
          ) : filteredParents.length === 0 ? (
            <Card className="p-12 text-center border-dashed border-2">
              <i className="ri-parent-line text-4xl text-gray-300 mb-4"></i>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">No parents found</h3>
              <p className="text-sm text-gray-500 mt-1">No intended parents are currently registered with this filter.</p>
            </Card>
          ) : viewStyle === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredParents.map((user) => (
                <Card key={user.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/parents/${user.id}`)}>
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
                       value={user.status || 'Inquiry'}
                       onChange={(e) => handleStatusUpdate(user.id, e.target.value as UserStatus)}
                     >
                        {IP_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
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
                  <thead className="bg-rose-50/50 dark:bg-white/5 text-gray-600 dark:text-gray-400 text-[10px] uppercase tracking-widest font-black">
                    <tr>
                      <th className="px-6 py-4 font-bold">Name</th>
                      <th className="px-6 py-4 font-bold">Received</th>
                      <th className="px-6 py-4 font-bold">Status</th>
                      <th className="px-6 py-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {filteredParents.map((user) => (
                      <tr key={user.id} className="hover:bg-rose-50/20 dark:hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => navigate(`/parents/${user.id}`)}>
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
                               value={user.status || 'Inquiry'}
                               onChange={(e) => handleStatusUpdate(user.id, e.target.value as UserStatus)}
                             >
                                {IP_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
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
        role="Intended Parent"
        onClose={() => setIsAddDialogOpen(false)}
        onSuccess={fetchParents}
      />
    </div>
  );
};

export default ParentsPage;
