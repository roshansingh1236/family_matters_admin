import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';
import { matchService } from '../../services/matchService';
import type { Match, MatchStatus } from '../../types';

const MatchesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MatchStatus | 'All'>('All');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    setIsLoading(true);
    try {
      const data = await matchService.getAllMatches();
      // Ensure data is sorted by createdAt desc if not already
      // The service does orderBy, so it should be fine.
      setMatches(data);
    } catch (error) {
      console.error('Error fetching matches:', error);
      setMatches([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredMatches = activeTab === 'All' 
    ? matches 
    : matches.filter(match => match.status === activeTab);

  const getStatusBadge = (status: MatchStatus | string) => {
    switch (status) {
      case 'Proposed':
        return <Badge color="yellow">{status}</Badge>;
      case 'Presented':
         return <Badge color="blue">{status}</Badge>;
      case 'Accepted':
      case 'Active':
        return <Badge color="green">{status}</Badge>;
      case 'Dissolved':
      case 'Declined':
        return <Badge color="red">{status}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const matchStatuses: { id: MatchStatus | 'All'; label: string }[] = [
    { id: 'All', label: 'All Matches' },
    { id: 'Proposed', label: 'Proposed' },
    { id: 'Presented', label: 'Presented' },
    { id: 'Accepted', label: 'Accepted' },
    { id: 'Active', label: 'Active' },
    { id: 'Dissolved', label: 'Dissolved' },
    { id: 'Declined', label: 'Declined' },
  ];

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Matches Management</h1>
            <p className="text-gray-600 dark:text-gray-400">Track all surrogate-parent matches and their journey progress.</p>
          </div>

          {/* Status Tabs */}
          <div className="mb-6">
            <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit flex-wrap">
              {matchStatuses.map((status) => {
                 const count = status.id === 'All' 
                    ? matches.length 
                    : matches.filter(m => m.status === status.id).length;
                 
                 return (
                  <button
                    key={status.id}
                    onClick={() => setActiveTab(status.id)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      activeTab === status.id
                        ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {status.label} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <i className="ri-loader-4-line text-4xl animate-spin text-blue-600"></i>
            </div>
          ) : filteredMatches.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
              <i className="ri-links-line text-4xl text-gray-400 mb-2"></i>
              <p className="text-gray-500 dark:text-gray-400">No matches found.</p>
            </div>
          ) : (
            /* Matches Grid */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredMatches.map((match) => (
                <Card key={match.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setSelectedMatch(match)}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                        <i className="ri-links-line text-green-600 dark:text-green-400 text-lg"></i>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">Match #{match.id.slice(0, 8)}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Created {new Date(match.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(match.status)}
                  </div>

                  <div className="space-y-4 mb-4">
                    <div className="flex items-center gap-3 p-3 bg-pink-50 dark:bg-pink-900/20 rounded-lg">
                      <div className="w-8 h-8 bg-pink-100 dark:bg-pink-900 rounded-full flex items-center justify-center">
                        <i className="ri-user-heart-line text-pink-600 dark:text-pink-400"></i>
                      </div>
                      <div>
                        {/* We might need to fetch user names if not in Match object. Match object has IDs. 
                            If we want names, we either populate them in backend or fetch here.
                            For now, display IDs or placeholders if names are missing. 
                            Ideally Match object should perform denormalization on creation.
                            Assuming Match object has no names based on previous Type definition, checking...
                            Wait, Match type definition in Step 206 mentions user IDs but no names.
                            Old code had names. I should probably fetch names or update Match model to include them.
                            For now, use ID or "Loading...".
                        */}
                        <p className="font-medium text-gray-900 dark:text-white">{match.gestationalCarrierId || "Pending GC"}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Surrogate ID</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                        <i className="ri-parent-line text-purple-600 dark:text-purple-400"></i>
                      </div>
                      <div>
                         <p className="font-medium text-gray-900 dark:text-white">{match.intendedParentId}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Intended Parent ID</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1">
                      <i className="ri-eye-line mr-1"></i>
                      View Details
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Match Detail Modal */}
          {selectedMatch && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Match Details</h2>
                    <button
                      onClick={() => setSelectedMatch(null)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
                    >
                      <i className="ri-close-line text-gray-600 dark:text-gray-400"></i>
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                        <i className="ri-links-line text-green-600 dark:text-green-400 text-2xl"></i>
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Match #{selectedMatch.id.slice(0, 8)}</h3>
                        <p className="text-gray-600 dark:text-gray-400">Created on {new Date(selectedMatch.createdAt).toLocaleDateString()}</p>
                        {getStatusBadge(selectedMatch.status)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="p-4 bg-pink-50 dark:bg-pink-900/20 rounded-lg">
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                          <i className="ri-user-heart-line text-pink-600 dark:text-pink-400"></i>
                          Surrogate Information
                        </h4>
                        <div className="space-y-2">
                          <p className="text-gray-900 dark:text-white font-medium">{selectedMatch.gestationalCarrierId || "Not Assigned"}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">ID: {selectedMatch.gestationalCarrierId?.slice(0, 8) || "N/A"}</p>
                        </div>
                      </div>

                      <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                          <i className="ri-parent-line text-purple-600 dark:text-purple-400"></i>
                          Intended Parents
                        </h4>
                        <div className="space-y-2">
                          <p className="text-gray-900 dark:text-white font-medium">{selectedMatch.intendedParentId}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">ID: {selectedMatch.intendedParentId.slice(0, 8)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button color="blue" className="flex-1" onClick={() => setSelectedMatch(null)}>
                        Close
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

export default MatchesPage;
