
import React, { useState } from 'react';
import { allMatches, matchStatuses } from '../../mocks/matchesData';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';

const MatchesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const filteredMatches = activeTab === 'all' 
    ? allMatches 
    : allMatches.filter(match => match.status === activeTab);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge color="yellow">Pending</Badge>;
      case 'active':
        return <Badge color="green">Active</Badge>;
      case 'pregnant':
        return <Badge color="blue">Pregnant</Badge>;
      case 'completed':
        return <Badge color="gray">Completed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getProgressPercentage = (currentStep: number, totalSteps: number) => {
    return Math.round((currentStep / totalSteps) * 100);
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Matches Management</h1>
            <p className="text-gray-600 dark:text-gray-400">Track all surrogate-parent matches and their journey progress.</p>
          </div>

          {/* Status Tabs */}
          <div className="mb-6">
            <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
              {matchStatuses.map((status) => (
                <button
                  key={status.id}
                  onClick={() => setActiveTab(status.id)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    activeTab === status.id
                      ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {status.label} ({status.count})
                </button>
              ))}
            </div>
          </div>

          {/* Matches Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredMatches.map((match) => (
              <Card key={match.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setSelectedMatch(match)}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                      <i className="ri-links-line text-green-600 dark:text-green-400 text-lg"></i>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">Match #{match.id}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Created {match.matchDate}</p>
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
                      <p className="font-medium text-gray-900 dark:text-white">{match.surrogateName}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Surrogate • {match.surrogateLocation}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                      <i className="ri-parent-line text-purple-600 dark:text-purple-400"></i>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{match.parentNames}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Intended Parents • {match.parentLocation}</p>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Journey Progress</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {getProgressPercentage(match.currentStep, match.totalSteps)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${getProgressPercentage(match.currentStep, match.totalSteps)}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Step {match.currentStep} of {match.totalSteps}: {match.currentMilestone}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" className="flex-1">
                    <i className="ri-eye-line mr-1"></i>
                    View Details
                  </Button>
                  <Button size="sm" color="blue">
                    <i className="ri-calendar-line"></i>
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {/* Match Detail Modal */}
          {selectedMatch && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
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
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Match #{selectedMatch.id}</h3>
                        <p className="text-gray-600 dark:text-gray-400">Created on {selectedMatch.matchDate}</p>
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
                          <p className="text-gray-900 dark:text-white font-medium">{selectedMatch.surrogateName}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Location: {selectedMatch.surrogateLocation}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Age: {selectedMatch.surrogateAge}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Experience: {selectedMatch.surrogateExperience}</p>
                        </div>
                      </div>

                      <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                          <i className="ri-parent-line text-purple-600 dark:text-purple-400"></i>
                          Intended Parents
                        </h4>
                        <div className="space-y-2">
                          <p className="text-gray-900 dark:text-white font-medium">{selectedMatch.parentNames}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Location: {selectedMatch.parentLocation}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Ages: {selectedMatch.parentAges}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Journey Type: {selectedMatch.journeyType}</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Journey Timeline</h4>
                      <div className="space-y-3">
                        {selectedMatch.milestones.map((milestone: any, index: number) => (
                          <div key={index} className="flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              milestone.completed 
                                ? 'bg-green-100 dark:bg-green-900' 
                                : index === selectedMatch.currentStep - 1
                                ? 'bg-blue-100 dark:bg-blue-900'
                                : 'bg-gray-100 dark:bg-gray-700'
                            }`}>
                              {milestone.completed ? (
                                <i className="ri-check-line text-green-600 dark:text-green-400"></i>
                              ) : index === selectedMatch.currentStep - 1 ? (
                                <i className="ri-time-line text-blue-600 dark:text-blue-400"></i>
                              ) : (
                                <span className="text-gray-400 text-sm">{index + 1}</span>
                              )}
                            </div>
                            <div className="flex-1">
                              <p className={`font-medium ${
                                milestone.completed 
                                  ? 'text-green-600 dark:text-green-400' 
                                  : index === selectedMatch.currentStep - 1
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : 'text-gray-600 dark:text-gray-400'
                              }`}>
                                {milestone.title}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">{milestone.description}</p>
                              {milestone.date && (
                                <p className="text-xs text-gray-400 dark:text-gray-500">{milestone.date}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button color="blue" className="flex-1">
                        <i className="ri-calendar-line mr-2"></i>
                        Schedule Appointment
                      </Button>
                      <Button variant="outline" className="flex-1">
                        <i className="ri-message-line mr-2"></i>
                        Send Update
                      </Button>
                      <Button variant="outline" className="flex-1">
                        <i className="ri-file-text-line mr-2"></i>
                        View Contract
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
