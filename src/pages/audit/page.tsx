import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Badge from '../../components/base/Badge';
import { auditService } from '../../services/auditService';
import type { AuditLogEntry } from '../../services/auditService';
import { hasPermission } from '../../utils/permissions';
import { useAuth } from '../../contexts/AuthContext';

const ENTITY_COLORS: Record<string, string> = {
  match: 'green', journey: 'blue', user: 'purple', transaction: 'yellow',
  reimbursable: 'orange', contract: 'teal', screening: 'pink',
  installment: 'gray', record_request: 'red',
};

const AuditPage: React.FC = () => {
  const { profile } = useAuth();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterEntity, setFilterEntity] = useState('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetchLog();
  }, [filterEntity]);

  const fetchLog = async () => {
    setIsLoading(true);
    try {
      const data = await auditService.getAll({
        entityType: filterEntity || undefined,
        limit: 500,
      });
      setEntries(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = entries.filter(e => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      e.action.toLowerCase().includes(s) ||
      e.actorEmail?.toLowerCase().includes(s) ||
      e.entityType.toLowerCase().includes(s) ||
      e.entityId?.toLowerCase().includes(s)
    );
  });

  if (!hasPermission(profile?.role, 'view_audit_log')) {
    return (
      <div className="flex h-screen bg-[#fdf4f6] dark:bg-[#0e0b1a]">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <i className="ri-lock-line text-5xl text-gray-300 mb-4 block"></i>
              <h2 className="text-xl font-bold text-gray-700 dark:text-white">Access Restricted</h2>
              <p className="text-gray-500 mt-2">Only Admin role can view the audit log.</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#fdf4f6] dark:bg-[#0e0b1a]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audit Log</h1>
              <p className="text-sm text-gray-500 mt-1">Immutable record of all admin actions. Append-only — no entries can be deleted.</p>
            </div>
          </div>

          {/* Filters */}
          <Card className="p-4 mb-6 flex flex-wrap gap-3">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search action, actor, entity ID..."
              className="flex-1 min-w-48 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#15111f] px-3 py-2 text-sm"
            />
            <select
              value={filterEntity}
              onChange={e => setFilterEntity(e.target.value)}
              className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#15111f] px-3 py-2 text-sm"
            >
              <option value="">All entity types</option>
              {['match','journey','user','transaction','reimbursable','contract','screening','installment','record_request'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <span className="text-sm text-gray-400 self-center">{filtered.length} entries</span>
          </Card>

          {isLoading ? (
            <div className="flex justify-center py-16"><i className="ri-loader-4-line text-3xl animate-spin text-blue-500"></i></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <i className="ri-file-search-line text-4xl mb-2 block"></i>
              No audit log entries found.
            </div>
          ) : (
            <Card className="overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-[#15111f] text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Entity</th>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(entry => (
                    <React.Fragment key={entry.id}>
                      <tr className="border-t border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5">
                        <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">
                          {new Date(entry.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-xs">
                          {entry.actorEmail || entry.actorId?.slice(0, 8) || '—'}
                        </td>
                        <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{entry.action}</td>
                        <td className="px-4 py-2">
                          <Badge color={(ENTITY_COLORS[entry.entityType] || 'gray') as any}>{entry.entityType}</Badge>
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-gray-500">{entry.entityId?.slice(0, 12) || '—'}</td>
                        <td className="px-4 py-2">
                          {(entry.beforeData || entry.afterData) && (
                            <button
                              onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                              className="text-xs text-blue-500 hover:underline"
                            >
                              {expanded === entry.id ? 'Hide' : 'View diff'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {expanded === entry.id && (
                        <tr className="border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/5">
                          <td colSpan={6} className="px-4 py-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {entry.beforeData && (
                                <div>
                                  <p className="text-xs font-semibold text-gray-500 mb-1">Before</p>
                                  <pre className="text-xs bg-white dark:bg-[#15111f] rounded p-2 overflow-x-auto border border-gray-200 dark:border-white/10">
                                    {JSON.stringify(entry.beforeData, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {entry.afterData && (
                                <div>
                                  <p className="text-xs font-semibold text-gray-500 mb-1">After</p>
                                  <pre className="text-xs bg-white dark:bg-[#15111f] rounded p-2 overflow-x-auto border border-gray-200 dark:border-white/10">
                                    {JSON.stringify(entry.afterData, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
};

export default AuditPage;
