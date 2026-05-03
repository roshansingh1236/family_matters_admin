import React from 'react';

interface RoadmapStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  status: 'completed' | 'current' | 'upcoming';
}

interface JourneyRoadmapProps {
  role: 'Surrogate' | 'Intended Parent';
  currentStatus: string;
}

export const JourneyRoadmap: React.FC<JourneyRoadmapProps> = ({ role, currentStatus }) => {
  const surrogateSteps: RoadmapStep[] = [
    { id: '1', title: 'Application', description: 'Complete initial intake form.', icon: 'ri-file-list-3-line', status: 'completed' },
    { id: '2', title: 'Screening', description: 'Background check & phone consult.', icon: 'ri-shield-user-line', status: 'current' },
    { id: '3', title: 'Medical Review', description: 'Reviewing OB and health records.', icon: 'ri-heart-pulse-line', status: 'upcoming' },
    { id: '4', title: 'Match Meeting', description: 'Meeting with Intended Parents.', icon: 'ri-team-line', status: 'upcoming' },
    { id: '5', title: 'Legal & Medical Clearance', description: 'Final clearances for transfer.', icon: 'ri-scales-3-line', status: 'upcoming' },
  ];

  const parentSteps: RoadmapStep[] = [
    { id: '1', title: 'Onboarding', description: 'Welcome call & portal setup.', icon: 'ri-user-add-line', status: 'completed' },
    { id: '2', title: 'Intake', description: 'Complete family profile & preferences.', icon: 'ri-profile-line', status: 'current' },
    { id: '3', title: 'Matching', description: 'Reviewing surrogate profiles.', icon: 'ri-search-eye-line', status: 'upcoming' },
    { id: '4', title: 'Match Meeting', description: 'Connect with your carrier.', icon: 'ri-heart-2-line', status: 'upcoming' },
    { id: '5', title: 'Escrow & Legal', description: 'Finalizing agreements.', icon: 'ri-bank-card-line', status: 'upcoming' },
  ];

  const steps = role === 'Surrogate' ? surrogateSteps : parentSteps;

  // Simple status mapping logic for demonstration parity with mobile
  const determineStatus = (idx: number): 'completed' | 'current' | 'upcoming' => {
     if (currentStatus === 'Accepted to Program' || currentStatus === 'Matched') return 'completed';
     if (idx === 0 && (currentStatus === 'New Inquiry' || currentStatus === 'New Application')) return 'current';
     if (idx === 1 && (currentStatus === 'Screening' || currentStatus === 'Reviewed')) return 'current';
     return idx < 1 ? 'completed' : 'upcoming';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Journey Roadmap</h3>
        <span className="text-xs font-semibold text-rose-500 uppercase tracking-widest bg-rose-50 dark:bg-rose-500/10 px-3 py-1 rounded-full">
          Standard Process
        </span>
      </div>

      <div className="relative">
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

                {status === 'current' && (
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
