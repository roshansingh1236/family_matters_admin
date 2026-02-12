import React, { useState } from 'react';
import Button from '../base/Button';
import EditableJsonSection from '../data/EditableJsonSection';

type AboutSectionProps = {
  title: string;
  data: Record<string, unknown> | null;
  onSave: (value: Record<string, unknown>) => Promise<void> | void;
  templateData?: Record<string, unknown>;
  emptyMessage?: string;
  type?: 'parent' | 'surrogate';
};

const AboutSection: React.FC<AboutSectionProps> = ({
  title,
  data,
  onSave,
  templateData,
  emptyMessage = "No information provided.",
  type = 'parent'
}) => {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
             <h3 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h3>
             <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
             </Button>
        </div>
        <EditableJsonSection
          title=""
          data={data}
          onSave={async (val) => {
            await onSave(val);
            setIsEditing(false);
          }}
          templateData={templateData}
        />
      </div>
    );
  }

  if (!data || Object.values(data).every(v => !v)) {
      return (
          <div className="flex flex-col items-center justify-center p-8 text-center bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
              <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-full mb-3">
                  <i className="ri-user-smile-line text-3xl text-gray-400"></i>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No About Info</h3>
              <p className="text-sm text-gray-500 max-w-xs mx-auto mb-4">{emptyMessage}</p>
              <Button size="sm" onClick={() => setIsEditing(true)}>
                  <i className="ri-add-line mr-2"></i>
                  Add Details
              </Button>
          </div>
      );
  }

  // Helper getters
  const get = (key: string) => data?.[key] as string | undefined;
  
  const bio = get('bio') || get('aboutUs');
  const age = get('age');
  const height = get('height');
  const occupation = get('occupation');
  const education = get('education');
  const religion = get('religion');
  const relationshipPref = get('relationshipPreference');

  const hobbies = get('hobbies');
  const lifestyle = get('familyLifestyle');
  const heritage = get('heritage') || [get('bioMotherHeritage'), get('bioFatherHeritage')].filter(Boolean).join(' & ');
  const amh = get('amhStatus');
  const secondCycle = get('opennessToSecondCycle');
  
  // Icon mapping helper
  const StatItem = ({ icon, label, value, className }: { icon: string, label: string, value?: string, className?: string }) => {
      if (!value) return null;
      return (
          <div className={`p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 flex items-start gap-4 ${className}`}>
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white dark:bg-gray-700 flex items-center justify-center text-primary-500 shadow-sm">
                  <i className={`${icon} text-xl`}></i>
              </div>
              <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
                  <p className="font-medium text-gray-900 dark:text-white leading-tight">{value}</p>
              </div>
          </div>
      );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            {title}
            <span className="px-2.5 py-0.5 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 text-xs font-bold uppercase tracking-wider">
                {type === 'parent' ? 'Family Profile' : 'Surrogate Profile'}
            </span>
          </h2>
          {/* Quick tags row */}
           <div className="flex flex-wrap gap-2 mt-2">
              {age && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-600 dark:text-gray-300">
                      <i className="ri-cake-line"></i> {age} years
                  </span>
              )}
              {height && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-600 dark:text-gray-300">
                      <i className="ri-ruler-line"></i> {height}
                  </span>
              )}
           </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
          <i className="ri-edit-line mr-2"></i>
          Edit
        </Button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatItem icon="ri-briefcase-line" label="Occupation" value={occupation} />
          <StatItem icon="ri-graduation-cap-line" label="Education" value={education} />
          <StatItem icon="ri-heart-2-line" label="Relationship Status" value={relationshipPref} />
          {heritage && <StatItem icon="ri-global-line" label="Heritage" value={heritage} />}
          {religion && <StatItem icon="ri-service-line" label="Religion" value={religion} />}
          {type === 'surrogate' && amh && <StatItem icon="ri-test-tube-line" label="AMH Level" value={amh} />}
          {type === 'surrogate' && secondCycle && <StatItem icon="ri-loop-right-line" label="Second Cycle" value={secondCycle} />}
      </div>

      {/* Bio / About Us */}
      {bio && (
        <div className="prose dark:prose-invert max-w-none">
            <div className="flex items-center gap-2 mb-3">
                <i className="ri-double-quotes-l text-3xl text-primary-200 dark:text-primary-800"></i>
                <h3 className="text-lg font-semibold m-0">
                    {type === 'parent' ? 'Our Story' : 'About Me'}
                </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300 text-lg leading-relaxed whitespace-pre-line pl-4 border-l-4 border-primary-100 dark:border-primary-900/50">
                {bio}
            </p>
        </div>
      )}

      {/* Tags: Hobbies & Lifestyle */}
      {(hobbies || lifestyle) && (
        <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            {hobbies && (
                <div>
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                        <i className="ri-seedling-line"></i> Hobbies & Interests
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {hobbies.split(/[,\n&]/).filter(Boolean).map((hobby, i) => (
                            <span key={i} className="inline-flex items-center px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-sm font-medium border border-blue-100 dark:border-blue-800/30">
                                {hobby.trim()}
                            </span>
                        ))}
                    </div>
                </div>
            )}
            
            {lifestyle && (
                <div className="mt-4">
                     <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                        <i className="ri-home-heart-line"></i> Family Lifestyle
                    </h4>
                     <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-100 dark:border-amber-800/30">
                        <p className="text-gray-700 dark:text-gray-300 italic">
                            "{lifestyle}"
                        </p>
                     </div>
                </div>
            )}
        </div>
      )}
    </div>
  );
};

export default AboutSection;
