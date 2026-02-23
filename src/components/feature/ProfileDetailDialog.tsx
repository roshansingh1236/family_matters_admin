import React from 'react';
import ParentProfileContent from './profiles/ParentProfileContent';
import SurrogateProfileContent from './profiles/SurrogateProfileContent';

interface ProfileDetailDialogProps {
  onClose: () => void;
  userId: string;
  role: 'Intended Parent' | 'Surrogate' | 'intendedParent' | 'gestationalCarrier';
}

const ProfileDetailDialog: React.FC<ProfileDetailDialogProps> = ({
  onClose,
  userId,
  role
}) => {
  const isParent = role === 'Intended Parent' || role === 'intendedParent';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-6xl max-h-[90vh] overflow-hidden bg-white dark:bg-gray-900 rounded-3xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 overflow-y-auto">
          {isParent ? (
            <ParentProfileContent id={userId} onClose={onClose} showBackButton={false} showCreateMatch={false} />
          ) : (
            <SurrogateProfileContent id={userId} onClose={onClose} showBackButton={false} showCreateMatch={false} />
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileDetailDialog;
