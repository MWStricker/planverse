import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';

export interface UserProfile {
  id: string;
  user_id: string;
  email?: string;
  display_name?: string;
  avatar_url?: string;
  major?: string;
  school?: string;
  timezone?: string;
  campus_location?: string;
  bio?: string;
  graduation_year?: number;
  is_public?: boolean;
  onboarding_completed?: boolean;
  onboarding_completed_at?: string;
  created_at: string;
  updated_at: string;
}

// Create a context for global profile state
interface ProfileContextType {
  profile: UserProfile | null;
  loading: boolean;
  uploading: boolean;
  updateProfile: (updates: Partial<UserProfile>) => Promise<UserProfile | undefined>;
  uploadAvatar: (file: File) => Promise<void>;
  refetch: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cleanupSubscription: (() => void) | null = null;
    
    if (user) {
      fetchProfile();
      cleanupSubscription = setupRealtimeSubscription();
    } else {
      setProfile(null);
      setLoading(false);
    }
    
    return () => {
      if (cleanupSubscription) {
        cleanupSubscription();
      }
    };
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    
    try {
      console.log('Fetching profile for user:', user.id);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Profile fetch error:', error);
        throw error;
      }

      if (data) {
        console.log('Profile fetched:', data);
        setProfile(data);
      } else {
        console.log('No profile found, creating new one');
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            email: user.email,
            display_name: user.user_metadata?.full_name || user.email?.split('@')[0]
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating profile:', createError);
          throw createError;
        }
        console.log('New profile created:', newProfile);
        setProfile(newProfile);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    if (!user) return;

    console.log('Setting up realtime subscription for user:', user.id);
    
    const channel = supabase
      .channel(`profile-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Profile realtime update received:', payload);
          
          if (payload.eventType === 'UPDATE' && payload.new) {
            console.log('Applying realtime profile update:', payload.new);
            setProfile(payload.new as UserProfile);
          } else if (payload.eventType === 'INSERT' && payload.new) {
            console.log('Applying realtime profile insert:', payload.new);
            setProfile(payload.new as UserProfile);
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      console.log('Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user || !profile) {
      console.error('❌ UPDATE FAILED: Missing user or profile:', { user: !!user, profile: !!profile });
      toast({
        title: "Error",
        description: "You must be logged in to update your profile",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('🔄 STARTING PROFILE UPDATE');
      console.log('📝 Updates to apply:', updates);
      console.log('👤 User ID:', user.id);
      console.log('📋 Current profile:', profile);
      
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('❌ PROFILE UPDATE ERROR:', error);
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      if (!data) {
        console.error('❌ UPDATE FAILED: No data returned');
        throw new Error('No data returned from update');
      }

      console.log('✅ PROFILE UPDATE SUCCESSFUL:', data);
      
      // Immediately update the local state for all consumers
      setProfile(data);
      
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
      
      return data;
    } catch (error) {
      console.error('❌ ERROR UPDATING PROFILE:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      });
      throw error;
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return;

    setUploading(true);
    try {
      if (profile?.avatar_url) {
        const oldPath = profile.avatar_url.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('avatars')
            .remove([`${user.id}/${oldPath}`]);
        }
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `avatar-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      await updateProfile({ avatar_url: publicUrl });

      toast({
        title: "Success",
        description: "Avatar uploaded successfully",
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: "Error",
        description: "Failed to upload avatar",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <ProfileContext.Provider value={{
      profile,
      loading,
      uploading,
      updateProfile,
      uploadAvatar,
      refetch: fetchProfile,
    }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};