import React, { useState, useEffect } from 'react';
import { supabase } from "../../lib/supabase";
import { Sidebar } from "../../components/feature/Sidebar";
import Header from "../../components/feature/Header";
import Card from "../../components/base/Card";
import Button from "../../components/base/Button";
import Badge from "../../components/base/Badge";
import { journeyService } from "../../services/journeyService";
import type { Journey, JourneyStatus } from "../../types";
import UserSelector from "../../components/feature/UserSelector";
import { useAuth } from "../../contexts/AuthContext";

// Helper type for UI preview
type MatchUserPreview = {
  id: string;
  name: string;
  email: string;
  role: string;
  status?: string;
  profileCompleted?: boolean;
  form2Completed?: boolean;
  location?: string;
  readinessLabel: string;
  readinessColor: "green" | "yellow" | "red" | "blue" | "gray";
};

const JourneysPage: React.FC = () => {
  const { user } = useAuth();
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<JourneyStatus | 'All'>('All');
  const [selectedJourney, setSelectedJourney] = useState<Journey | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [progressNotes, setProgressNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // For creating new journey manually
  const [newJourneyData, setNewJourneyData] = useState({
    gestationalCarrierId: "",
    intendedParentId: "",
    notes: "",
  });
  const [surrogatePreview, setSurrogatePreview] = useState<MatchUserPreview | null>(null);
  const [parentPreview, setParentPreview] = useState<MatchUserPreview | null>(null);

  const adminId = user?.id || "";

  const stages: JourneyStatus[] = [
    "Medical Screening",
    "Legal",
    "Embryo Transfer",
    "Pregnancy",
    "Birth",
    "Completed",
    // "Cancelled" - usually not a linear stage
  ];

  const fetchJourneys = async () => {
    setIsLoading(true);
    try {
      const data = await journeyService.getAllJourneys();
      setJourneys(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load journeys");
      setJourneys([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJourneys();
  }, []);

  // Helper to build preview (reused logic from milestones)
  const buildUserPreview = (
    id: string,
    role: "Surrogate" | "Intended Parent",
    data: Record<string, unknown>
  ): MatchUserPreview => {
    const formData = data.formData as Record<string, unknown> | undefined;
    const firstName =
      (formData?.firstName as string | undefined) ||
      (data.firstName as string | undefined) ||
      "";
    const lastName =
      (formData?.lastName as string | undefined) ||
      (data.lastName as string | undefined) ||
      "";
    const name =
      [firstName, lastName].filter(Boolean).join(" ") ||
      ((data.email as string | undefined) ?? "Unknown user");
    const city = (formData?.city as string | undefined) || "";
    const state = (formData?.state as string | undefined) || "";
    const location = [city, state].filter(Boolean).join(", ");
    const status = (data.status as string | undefined) || undefined;
    const profileCompleted = Boolean(data.profileCompleted);
    const form2Completed = Boolean(data.form2Completed);

    let readinessLabel = "";
    let readinessColor: MatchUserPreview["readinessColor"] = "gray";

    if (role === "Surrogate") {
      if (status === "Pregnant") {
        readinessLabel = "Not eligible: pregnant";
        readinessColor = "red";
      } else if (!profileCompleted || !form2Completed) {
        readinessLabel = "Needs screening";
        readinessColor = "yellow";
      } else {
        readinessLabel = "Ready";
        readinessColor = "green";
      }
    } else {
      if (!profileCompleted) {
        readinessLabel = "Complete intake first";
        readinessColor = "yellow";
      } else {
        readinessLabel = "Ready";
        readinessColor = "green";
      }
    }

    return {
      id,
      name,
      email: (data.email as string | undefined) || "",
      role,
      status,
      profileCompleted,
      form2Completed,
      location,
      readinessLabel,
      readinessColor,
    };
  };

  const fetchUserPreview = async (
    id: string,
    role: "Surrogate" | "Intended Parent"
  ) => {
    if (!id) return;
    try {
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();
        
      if (fetchError) throw fetchError;
      if (!data) return;
      
      const preview = buildUserPreview(data.id, role, data as any);
      if (role === "Surrogate") {
        setSurrogatePreview(preview);
      } else {
        setParentPreview(preview);
      }
    } catch (e) {
      console.error("Failed to load user preview", e);
    }
  };

  const handleCreateJourney = async () => {
    if (!newJourneyData.gestationalCarrierId || !newJourneyData.intendedParentId) {
      setError("Please select both surrogate and parent");
      return;
    }

    try {
      // In a real flow, checking for existing match or creating one would be ideal.
      // Here we assume we are jumpstarting a journey.
      // We generate a dummy matchId or use one if we had match selection.
      const dummyMatchId = crypto.randomUUID(); 

      await journeyService.createJourney({
        matchId: dummyMatchId,
        gestationalCarrierId: newJourneyData.gestationalCarrierId,
        intendedParentId: newJourneyData.intendedParentId,
        caseManagerId: adminId,
        caseNumber: `CASE-${Date.now().toString().slice(-6)}`,
        status: "Medical Screening",
        milestones: [],
        documents: [],
        payments: [],
        journeyNotes: { initial: newJourneyData.notes }
      });

      await fetchJourneys();
      setShowCreateModal(false);
      setNewJourneyData({
        gestationalCarrierId: "",
        intendedParentId: "",
        notes: "",
      });
      setSurrogatePreview(null);
      setParentPreview(null);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to create journey");
    }
  };

  const filteredJourneys =
    selectedStatus === "All"
      ? journeys
      : journeys.filter((j) => j.status === selectedStatus);

  const getStatusColor = (status: JourneyStatus | string): "blue" | "green" | "red" | "yellow" => {
    switch (status) {
      case "Medical Screening":
      case "Legal":
        return "blue";
      case "Embryo Transfer":
      case "Pregnancy":
      case "Birth":
      case "Completed":
        return "green";
      case "Cancelled":
        return "red";
      default:
        return "blue";
    }
  };

  const getStatusProgress = (status: JourneyStatus | string): number => {
    const s = status as JourneyStatus;
    const index = stages.indexOf(s);
    if (index === -1) {
       if (status === "Cancelled") return 100; // or 0
       return 0;
    }
    return Math.round(((index + 1) / stages.length) * 100);
  };

  const getNextStage = (current: JourneyStatus | string): JourneyStatus | null => {
      const idx = stages.indexOf(current as JourneyStatus);
      if (idx !== -1 && idx < stages.length - 1) {
          return stages[idx + 1];
      }
      return null;
  };

  const handleProgressStage = async () => {
    if (!selectedJourney) return;

    try {
      const nextStage = getNextStage(selectedJourney.status);
      if (!nextStage) {
        setError("Journey is already at the final stage");
        return;
      }

      await journeyService.updateJourneyStatus(selectedJourney.id, nextStage);

      await fetchJourneys();
      setShowProgressModal(false);
      setSelectedJourney(null);
      setProgressNotes("");
    } catch (err) {
      console.error(err);
      setError("Failed to progress journey");
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
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
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Journeys
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Journey stage management and tracking.
                </p>
              </div>
              <Button color="blue" onClick={() => setShowCreateModal(true)}>
                <i className="ri-add-line mr-2"></i>
                New Journey
              </Button>
            </div>
          </div>

          {/* Stage Filter Tabs */}
          <div className="mb-6 flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedStatus("All")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedStatus === "All"
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              All ({journeys.length})
            </button>
            {stages.map((stage) => (
              <button
                key={stage}
                onClick={() => setSelectedStatus(stage)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedStatus === stage
                    ? "bg-blue-600 text-white"
                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                {stage} ({journeys.filter((j) => j.status === stage).length})
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
              {filteredJourneys.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                  <i className="ri-roadmap-line text-4xl text-gray-400 mb-2"></i>
                  <p className="text-gray-500 dark:text-gray-400">
                    No journeys found.
                  </p>
                </div>
              ) : (
                filteredJourneys.map((journey) => (
                  <Card
                    key={journey.id}
                    className="hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => setSelectedJourney(journey)}
                  >
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                             {/* Ideally fetch names. Using IDs for now as per refactor plan */}
                             Journey #{journey.caseNumber}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            Started {formatDate(journey.createdAt)}
                          </p>
                        </div>
                        <Badge color={getStatusColor(journey.status)}>
                          {journey.status}
                        </Badge>
                      </div>

                      {/* Progress Bar */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Journey Progress
                          </span>
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {getStatusProgress(journey.status)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                            style={{
                              width: `${getStatusProgress(journey.status)}%`,
                            }}
                          ></div>
                        </div>
                      </div>

                      {/* Stage Timeline */}
                      <div className="flex items-center gap-2 overflow-x-auto pb-2">
                        {stages.map((stage, index) => {
                          const currentStage = journey.status as JourneyStatus;
                          const currentIndex = stages.indexOf(currentStage);
                          const thisIndex = stages.indexOf(stage);
                          
                          const isPast = thisIndex < currentIndex;
                          const isCurrent = thisIndex === currentIndex;

                          return (
                            <div key={stage} className="flex items-center">
                              <div
                                className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium ${
                                  isPast
                                    ? "bg-green-500 text-white"
                                    : isCurrent
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                                }`}
                                title={stage}
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
                                    isPast
                                      ? "bg-green-500"
                                      : "bg-gray-200 dark:bg-gray-700"
                                  }`}
                                ></div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Journey Detail Modal */}
          {selectedJourney && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
              <div className="bg-white dark:bg-gray-800 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      Journey Details
                    </h2>
                    <button
                      onClick={() => setSelectedJourney(null)}
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
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                            Surrogate ID
                          </h4>
                          <p className="text-gray-600 dark:text-gray-300">
                            {selectedJourney.gestationalCarrierId}
                          </p>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                            Parent ID
                          </h4>
                          <p className="text-gray-600 dark:text-gray-300">
                            {selectedJourney.intendedParentId}
                          </p>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                            Status
                          </h4>
                          <Badge
                            color={getStatusColor(selectedJourney.status)}
                          >
                            {selectedJourney.status}
                          </Badge>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                            Started
                          </h4>
                          <p className="text-gray-600 dark:text-gray-300">
                            {formatDate(selectedJourney.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                      {getNextStage(selectedJourney.status) ? (
                        <Button
                          color="blue"
                          className="flex-1"
                          onClick={() => {
                            setShowProgressModal(true);
                          }}
                        >
                          <i className="ri-arrow-right-line mr-2"></i>
                          Progress to{" "}
                          {getNextStage(selectedJourney.status)}
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
          {showProgressModal && selectedJourney && (
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
                        Progress journey from{" "}
                        <span className="font-semibold">
                          {selectedJourney.status}
                        </span>{" "}
                        to{" "}
                        <span className="font-semibold">
                          {getNextStage(selectedJourney.status)}
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
                      <Button
                        color="blue"
                        className="flex-1"
                        onClick={handleProgressStage}
                      >
                        Confirm Progress
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Create Journey Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
              <div className="bg-white dark:bg-gray-800 rounded-xl max-w-3xl w-full shadow-2xl">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      Create New Journey
                    </h2>
                    <button
                      onClick={() => setShowCreateModal(false)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <i className="ri-close-line text-xl text-gray-600 dark:text-gray-400"></i>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-pink-100 dark:bg-pink-900 flex items-center justify-center">
                              <i className="ri-user-heart-line text-pink-600 dark:text-pink-300"></i>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                Surrogate
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Gestational carrier profile
                              </p>
                            </div>
                          </div>
                          {surrogatePreview && (
                            <Badge
                              color={surrogatePreview.readinessColor}
                              size="sm"
                            >
                              {surrogatePreview.readinessLabel}
                            </Badge>
                          )}
                        </div>
                        <UserSelector
                          value={newJourneyData.gestationalCarrierId}
                          onChange={(id) => {
                            setNewJourneyData({ ...newJourneyData, gestationalCarrierId: id });
                            if (!id) {
                              setSurrogatePreview(null);
                            }
                          }}
                          onSelect={(user) => {
                            setNewJourneyData({
                              ...newJourneyData,
                              gestationalCarrierId: user.id
                            });
                            fetchUserPreview(user.id, "Surrogate");
                          }}
                          role="Surrogate"
                          label="Select Surrogate"
                          placeholder="Choose a surrogate..."
                          required
                        />
                         {/* Surrogate Preview UI ... simplified from milestones */}
                         {surrogatePreview && <div className="mt-2 text-sm">{surrogatePreview.name}</div>}
                      </div>
                      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                              <i className="ri-parent-line text-blue-600 dark:text-blue-300"></i>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                Intended Parent
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                IP profile
                              </p>
                            </div>
                          </div>
                          {parentPreview && (
                            <Badge
                              color={parentPreview.readinessColor}
                              size="sm"
                            >
                              {parentPreview.readinessLabel}
                            </Badge>
                          )}
                        </div>
                        <UserSelector
                          value={newJourneyData.intendedParentId}
                          onChange={(id) => {
                            setNewJourneyData({ ...newJourneyData, intendedParentId: id });
                            if (!id) {
                              setParentPreview(null);
                            }
                          }}
                          onSelect={(user) => {
                            setNewJourneyData({
                              ...newJourneyData,
                              intendedParentId: user.id
                            });
                            fetchUserPreview(user.id, "Intended Parent");
                          }}
                          role="Intended Parent"
                          label="Select Parent"
                          placeholder="Choose a parent..."
                          required
                        />
                        {parentPreview && <div className="mt-2 text-sm">{parentPreview.name}</div>}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Initial Notes
                      </label>
                      <textarea
                        value={newJourneyData.notes}
                        onChange={(e) =>
                          setNewJourneyData({ ...newJourneyData, notes: e.target.value })
                        }
                        rows={3}
                        className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-all"
                        placeholder="Add any initial notes or details about this journey..."
                      ></textarea>
                    </div>

                    <div className="flex gap-3 pt-2">
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
                        onClick={handleCreateJourney}
                      >
                         Create Journey
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

export default JourneysPage;
