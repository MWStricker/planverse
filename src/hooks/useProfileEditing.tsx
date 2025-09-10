import { createContext, useContext, useState, ReactNode } from 'react';

interface ProfileEditingContextType {
  liveEditedProfile: {
    display_name?: string;
    major?: string;
    school?: string;
  };
  updateLiveProfile: (field: string, value: string) => void;
}

const ProfileEditingContext = createContext<ProfileEditingContextType | undefined>(undefined);

export const ProfileEditingProvider = ({ children }: { children: ReactNode }) => {
  const [liveEditedProfile, setLiveEditedProfile] = useState<{
    display_name?: string;
    major?: string;
    school?: string;
  }>({});

  const updateLiveProfile = (field: string, value: string) => {
    setLiveEditedProfile(prev => ({ ...prev, [field]: value }));
  };

  return (
    <ProfileEditingContext.Provider value={{ liveEditedProfile, updateLiveProfile }}>
      {children}
    </ProfileEditingContext.Provider>
  );
};

export const useProfileEditing = () => {
  const context = useContext(ProfileEditingContext);
  if (context === undefined) {
    throw new Error('useProfileEditing must be used within a ProfileEditingProvider');
  }
  return context;
};