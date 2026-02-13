import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';
import { milestoneService, type SurrogacyCase, type JourneyStage } from '../../services/milestoneService';
import UserSelector from '../../components/feature/UserSelector';

const MilestonesPage: React.FC = () => {
  const [cases, setCases] = useState<SurrogacyCase[]>([]);
  const [selectedStage, setSelectedStage] = useState<JourneyStage | 'all'>('all');
  const [selectedCase, setSelectedCase] = useState<SurrogacyCase | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [progressNotes, setProgressNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Users for case creation
  const [newCaseData, setNewCaseData] = useState({
    surrogateId: '',
    surrogateName: '',
    parentId: '',
    parentName: '',
    notes: ''
  });

  const adminId = 'admin123'; // In production, get from auth context

  const stages: JourneyStage[] = ['Matching', 'Screening', 'Medical', 'Legal', 'Pregnancy', 'Completed'];

  const fetchCases = async () => {
    setIsLoading(true);
    try {
      const data = await milestoneService.getAllCases();
      setCases(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to load cases');
      setCases([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const handleCreateCase = async () => {
    if (!newCaseData.surrogateId || !newCaseData.parentId) {
      setError('Please select both surrogate and parent');
      return;
    }

    try {
      await milestoneService.createCase({
        surrogateId: newCaseData.surrogateId,
        surrogateName: newCaseData.surrogateName,
        parentId: newCaseData.parentId,
        parentName: newCaseData.parentName,
        currentStage: 'Matching',
        notes: newCaseData.notes
      });

      await fetchCases();
      setShowCreateModal(false);
      setNewCaseData({ 
        surrogateId: '', 
        surrogateName: '',
        parentId: '', 
        parentName: '',
        notes: '' 
      });
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to create case');
    }
  };

  const filteredCases = selectedStage === 'all' 
    ? cases 
    : cases.filter(c => c.currentStage === selectedStage);

  const getStageColor = (stage: JourneyStage): 'blue' | 'green' | 'red' => {
    switch (stage) {
      case 'Matching':
      case 'Screening':
        return 'blue';
      case 'Medical':
      case 'Legal':
      case 'Pregnancy':
        return 'green';
      case 'Completed':
        return 'green';
      default:
        return 'blue';
    }
  };

  const getStageProgress = (stage: JourneyStage): number => {
    const index = stages.indexOf(stage);
    return ((index + 1) / stages.length) * 100;
  };

  const handleProgressStage = async () => {
    if (!selectedCase) return;

    try {
      const nextStage = milestoneService.getNextStage(selectedCase.currentStage);
      if (!nextStage) {
        setError('Case is already at the final stage');
        return;
      }

      await milestoneService.updateCaseStage(
        selectedCase.id!,
        nextStage,
        adminId,
        progressNotes
      );

      await fetchCases();
      setShowProgressModal(false);
      setSelectedCase(null);
      setProgressNotes('');
    } catch (err) {
      console.error(err);
      setError('Failed to progress case');
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Milestones</h1>
                <p className="text-gray-600 dark:text-gray-400">Journey stage management and tracking.</p>
              </div>
              <Button color="blue" onClick={() => setShowCreateModal(true)}>
                <i className="ri-add-line mr-2"></i>
                New Case
              </Button>
            </div>
          </div>

          {/* Stage Filter Tabs */}
          <div className="mb-6 flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedStage('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedStage === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              All ({cases.length})
            </button>
            {stages.map((stage) => (
              <button
                key={stage}
                onClick={() => setSelectedStage(stage)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedStage === stage
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {stage} ({cases.filter(c => c.currentStage === stage).length})
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <i className="ri-loader-4-line text-4xl animate-spin text-blue-600"></i>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCases.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                  <i className="ri-roadmap-line text-4xl text-gray-400 mb-2"></i>
                  <p className="text-gray-500 dark:text-gray-400">No cases found.</p>
                </div>
              ) : (
                filteredCases.map((caseItem) => (
                  <Card 
                    key={caseItem.id} 
                    className="hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => setSelectedCase(caseItem)}
                  >
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {caseItem.surrogateName} & {caseItem.parentName}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            Started {formatDate(caseItem.createdAt!)}
                          </p>
                        </div>
                        <Badge color={getStageColor(caseItem.currentStage)}>
                          {caseItem.currentStage}
                        </Badge>
                      </div>

                      {/* Progress Bar */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Journey Progress
                          </span>
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {Math.round(getStageProgress(caseItem.currentStage))}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${getStageProgress(caseItem.currentStage)}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Stage Timeline */}
                      <div className="flex items-center gap-2 overflow-x-auto pb-2">
                        {stages.map((stage, index) => {
                          const currentIndex = stages.indexOf(caseItem.currentStage);
                          const isPast = index < currentIndex;
                          const isCurrent = index === currentIndex;

                          return (
                            <div key={stage} className="flex items-center">
                              <div
                                className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium ${
                                  isPast
                                    ? 'bg-green-500 text-white'
                                    : isCurrent
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                                }`}
                              >
                                {isPast ? (
                                  <i className="ri-check-line"></i>
                                ) : (
                                  index + 1
                                )}
                              </div>
                              {index < stages.length - 1 && (
                                <div
                                  className={`w-8 h-0.5 ${
                                    isPast ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
                                  }`}
                                ></div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {caseItem.notes && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                          Note: {caseItem.notes}
                        </p>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Case Detail Modal */}
          {selectedCase && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
              <div className="bg-white dark:bg-gray-800 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Case Details</h2>
                    <button
                      onClick={() => setSelectedCase(null)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <i className="ri-close-line text-xl text-gray-600 dark:text-gray-400"></i>
                    </button>
                  </div>

                  <div className="space-y-6">
                    {/* Case Info */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-xl space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Surrogate</h4>
                          <p className="text-gray-600 dark:text-gray-300">{selectedCase.surrogateName}</p>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Parent</h4>
                          <p className="text-gray-600 dark:text-gray-300">{selectedCase.parentName}</p>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Current Stage</h4>
                          <Badge color={getStageColor(selectedCase.currentStage)}>
                            {selectedCase.currentStage}
                          </Badge>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Started</h4>
                          <p className="text-gray-600 dark:text-gray-300">
                            {formatDate(selectedCase.createdAt!)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Stage History */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Stage History
                      </h3>
                      {selectedCase.stageHistory.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400 text-sm">No completed stages yet</p>
                      ) : (
                        <div className="space-y-3">
                          {selectedCase.stageHistory.map((entry, index) => (
                            <div
                              key={index}
                              className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                            >
                              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                                <i className="ri-check-line text-white"></i>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <h4 className="font-semibold text-gray-900 dark:text-white">
                                    {entry.stage}
                                  </h4>
                                  <span className="text-sm text-gray-600 dark:text-gray-400">
                                    {formatDate(entry.completedAt)}
                                  </span>
                                </div>
                                {entry.notes && (
                                  <p className="text-sm text-gray-600 dark:text-gray-300">
                                    {entry.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                      {milestoneService.getNextStage(selectedCase.currentStage) ? (
                        <Button
                          color="blue"
                          className="flex-1"
                          onClick={() => {
                            setShowProgressModal(true);
                          }}
                        >
                          <i className="ri-arrow-right-line mr-2"></i>
                          Progress to {milestoneService.getNextStage(selectedCase.currentStage)}
                        </Button>
                      ) : (
                        <div className="flex-1 p-3 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg text-center font-medium">
                          <i className="ri-check-double-line mr-2"></i>
                          Journey Completed
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Progress Confirmation Modal */}
          {showProgressModal && selectedCase && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
              <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full shadow-2xl">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      Progress Stage
                    </h2>
                    <button
                      onClick={() => setShowProgressModal(false)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <i className="ri-close-line text-xl text-gray-600 dark:text-gray-400"></i>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        Progress case from{' '}
                        <span className="font-semibold">{selectedCase.currentStage}</span> to{' '}
                        <span className="font-semibold">
                          {milestoneService.getNextStage(selectedCase.currentStage)}
                        </span>
                        ?
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Completion Notes (Optional)
                      </label>
                      <textarea
                        value={progressNotes}
                        onChange={(e) => setProgressNotes(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                        placeholder="Add any notes about this stage completion..."
                      ></textarea>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setShowProgressModal(false)}
                      >
                        Cancel
                      </Button>
                      <Button color="blue" className="flex-1" onClick={handleProgressStage}>
                        Confirm Progress
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Create Case Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
              <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full shadow-2xl">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      Create New Case
                    </h2>
                    <button
                      onClick={() => setShowCreateModal(false)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <i className="ri-close-line text-xl text-gray-600 dark:text-gray-400"></i>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <UserSelector
                        value={newCaseData.surrogateId}
                        onChange={(id) => setNewCaseData({ ...newCaseData, surrogateId: id })}
                        onSelect={(user) => setNewCaseData({ 
                          ...newCaseData, 
                          surrogateId: user.id, 
                          surrogateName: user.name.split(' (')[0] 
                        })}
                        role="Surrogate"
                        label="Select Surrogate"
                        placeholder="Choose a surrogate..."
                        required
                      />
                    </div>

                    <div>
                      <UserSelector
                        value={newCaseData.parentId}
                        onChange={(id) => setNewCaseData({ ...newCaseData, parentId: id })}
                        onSelect={(user) => setNewCaseData({ 
                          ...newCaseData, 
                          parentId: user.id, 
                          parentName: user.name.split(' (')[0] 
                        })}
                        role="Intended Parent"
                        label="Select Parent"
                        placeholder="Choose a parent..."
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Initial Notes (Optional)
                      </label>
                      <textarea
                        value={newCaseData.notes}
                        onChange={(e) => setNewCaseData({ ...newCaseData, notes: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                        placeholder="Add any initial notes about this case..."
                      ></textarea>
                    </div>

                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        <i className="ri-information-line mr-1"></i>
                        The case will start at the <span className="font-semibold">Matching</span> stage.
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setShowCreateModal(false)}
                      >
                        Cancel
                      </Button>
                      <Button 
                        color="blue" 
                        className="flex-1" 
                        onClick={handleCreateCase}
                        disabled={!newCaseData.surrogateId || !newCaseData.parentId}
                      >
                        Create Case
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

export default MilestonesPage;
