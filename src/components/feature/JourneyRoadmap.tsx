import React from 'react';

interface RoadmapStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  // User statuses during which this step is the "current" one. Keep in step with
  // GC_STATUSES / IP_STATUSES in src/types/index.ts.
  statuses: string[];
}

interface JourneyRoadmapProps {
  role: 'Surrogate' | 'Intended Parent';
  currentStatus: string;
}

const surrogateSteps: RoadmapStep[] = [
  { id: '1', title: 'Application', description: 'Complete initial intake form.', icon: 'ri-file-list-3-line', statuses: ['New Application'] },
  { id: '2', title: 'Screening', description: 'Background check & phone consult.', icon: 'ri-shield-user-line', statuses: ['Reviewed/Contacted', 'Profile Sent', 'Profile Received', 'Interview Scheduled'] },
  { id: '3', title: 'Medical Review', description: 'Reviewing OB and health records.', icon: 'ri-heart-pulse-line', statuses: ['Review Medical Records', 'Medical Records Requested', 'Medical Records Received', 'Psych Evaluation', 'Psych Complete'] },
  { id: '4', title: 'Match Meeting', description: 'Meeting with Intended Parents.', icon: 'ri-team-line', statuses: ['Accepted into Program', 'Ready to Match'] },
  { id: '5', title: 'Legal & Medical Clearance', description: 'Final clearances for transfer.', icon: 'ri-scales-3-line', statuses: ['Matched'] },
];

const parentSteps: RoadmapStep[] = [
  { id: '1', title: 'Onboarding', description: 'Welcome call & portal setup.', icon: 'ri-user-add-line', statuses: ['Inquiry', 'Consultation Pending', 'Consultation Scheduled'] },
  { id: '2', title: 'Intake', description: 'Complete family profile & preferences.', icon: 'ri-profile-line', statuses: ['Consultation Complete', 'Profile Pending'] },
  { id: '3', title: 'Matching', description: 'Reviewing surrogate profiles.', icon: 'ri-search-eye-line', statuses: ['Profile Complete', 'Match Pending'] },
  { id: '4', title: 'Match Meeting', description: 'Connect with your carrier.', icon: 'ri-heart-2-line', statuses: [] },
  { id: '5', title: 'Escrow & Legal', description: 'Finalizing agreements.', icon: 'ri-bank-card-line', statuses: ['Matched'] },
];

// Statuses that pause or end the journey instead of placing it on a step.
const HALTED_STATUSES: Record<string, string> = {
  'on hold': 'On Hold',
  'rejected': 'Rejected',
  'declined / inactive': 'Declined / Inactive',
};

const norm = (s: string | undefined) => (s ?? '').trim().toLowerCase();

export const JourneyRoadmap: React.FC<JourneyRoadmapProps> = ({ role, currentStatus }) => {
  const steps = role === 'Surrogate' ? surrogateSteps : parentSteps;
  const status = norm(currentStatus);
  const haltedLabel = HALTED_STATUSES[status];
  const currentIdx = steps.findIndex(step => step.statuses.some(s => norm(s) === status));

  if (import.meta.env.DEV && currentIdx === -1 && !haltedLabel) {
    console.warn(`[JourneyRoadmap] Status "${currentStatus}" is not mapped to a ${role} roadmap step.`);
  }

  const determineStatus = (idx: number): 'completed' | 'current' | 'upcoming' => {
    if (currentIdx === -1) return 'upcoming';
    if (idx < currentIdx) return 'completed';
    return idx === currentIdx ? 'current' : 'upcoming';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Journey Roadmap</h3>
        {haltedLabel ? (
          <span className="text-xs font-semibold text-amber-600 uppercase tracking-widest bg-amber-50 dark:bg-amber-500/10 px-3 py-1 rounded-full">
            {haltedLabel}
          </span>
        ) : (
          <span className="text-xs font-semibold text-rose-500 uppercase tracking-widest bg-rose-50 dark:bg-rose-500/10 px-3 py-1 rounded-full">
            Standard Process
          </span>
        )}
      </div>

      <div className={`relative ${haltedLabel ? 'opacity-50 grayscale' : ''}`}>
        {/* Progress Line */}
        <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-gray-100 dark:bg-white/5" />

        <div className="space-y-8">
          {steps.map((step, idx) => {
            const status = determineStatus(idx);
            return (
              <div key={step.id} className="relative flex items-start gap-6 group">
                <div className={`relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-4 border-white dark:border-[#0e0b1a] shadow-sm transition-all ${
                  status === 'completed' ? 'bg-emerald-500 text-white' :
                  status === 'current' ? 'bg-blue-600 text-white scale-110 shadow-blue-200' :
                  'bg-gray-100 dark:bg-white/5 text-gray-400'
                }`}>
                  <i className={`${step.icon} text-xl`} />
                </div>

                <div className="pt-1">
                  <h4 className={`font-bold text-sm ${status === 'upcoming' ? 'text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                    {step.title}
                  </h4>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {status === 'current' && !haltedLabel && (
                  <div className="absolute -left-1 top-4 h-14 w-14 rounded-full bg-blue-500/20 animate-pulse -z-10" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
