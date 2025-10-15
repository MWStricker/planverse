import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SpotifyNowPlayingCard } from '@/components/SpotifyNowPlayingCard';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  FloatingActionPanelRoot,
  FloatingActionPanelTrigger,
  FloatingActionPanelContent,
  FloatingActionPanelButton,
} from '@/components/ui/floating-action-panel';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  User,
  GraduationCap,
  School,
  Calendar,
  MapPin,
  Edit2,
  Save,
  X,
  Eye,
  EyeOff,
  Instagram,
  Tv,
  Github,
  Twitter,
  Youtube,
  Link,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { universities } from '@/data/universities';
import { collegeMajors } from '@/data/collegeMajors';

const getPlatformIcon = (platform: string) => {
  const icons: Record<string, any> = {
    instagram: Instagram,
    twitch: Tv,
    github: Github,
    twitter: Twitter,
    youtube: Youtube
  };
  return icons[platform.toLowerCase()] || Link;
};

const extractUsername = (url: string, platform: string): string | null => {
  if (!url || typeof url !== 'string') return null;
  
  const patterns: Record<string, RegExp> = {
    instagram: /instagram\.com\/([a-zA-Z0-9_.]+)/,
    twitch: /twitch\.tv\/([a-zA-Z0-9_]+)/,
    github: /github\.com\/([a-zA-Z0-9-]+)/,
    twitter: /(twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/,
    youtube: /youtube\.com\/(c\/|channel\/|user\/|@)?([a-zA-Z0-9_-]+)|youtu\.be\/([a-zA-Z0-9_-]+)/
  };
  
  const match = url.match(patterns[platform.toLowerCase()]);
  return match ? (match[2] || match[1]) : null;
};

const getPlatformColor = (platform: string): string => {
  const colors: Record<string, string> = {
    instagram: 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500',
    youtube: 'bg-red-600',
    twitch: 'bg-purple-600',
    github: 'bg-gray-800',
    twitter: 'bg-sky-500'
  };
  return colors[platform.toLowerCase()] || 'bg-gray-500';
};

interface ProfilePageProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ProfilePage = ({ open, onOpenChange }: ProfilePageProps) => {
  const { user } = useAuth();
  const { profile, refetch, updateProfile } = useProfile();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    display_name: profile?.display_name || '',
    school: profile?.school || '',
    major: profile?.major || '',
    graduation_year: profile?.graduation_year || new Date().getFullYear() + 4,
    bio: profile?.bio || '',
    campus_location: profile?.campus_location || '',
    is_public: profile?.is_public ?? true
  });

  // Update form data when profile changes OR when dialog opens
  React.useEffect(() => {
    if (profile) {
      console.log('ProfilePage: Updating form data from profile:', profile);
      setFormData({
        display_name: profile.display_name || '',
        school: profile.school || '',
        major: profile.major || '',
        graduation_year: profile.graduation_year || new Date().getFullYear() + 4,
        bio: profile.bio || '',
        campus_location: profile.campus_location || '',
        is_public: profile.is_public ?? true
      });
    }
  }, [profile, open]);

  const handleSave = async () => {
    if (!user?.id) {
      console.error('No user ID available for save');
      return;
    }

    setIsLoading(true);
    try {
      console.log('ProfilePage: Starting save with form data:', formData);
      console.log('ProfilePage: User ID:', user.id);
      console.log('ProfilePage: Current profile:', profile);
      
      // Use the updateProfile method from the hook instead of direct database call
      const updatedProfile = await updateProfile(formData);
      
      if (updatedProfile) {
        console.log('ProfilePage: Profile saved successfully via hook:', updatedProfile);
        
        // Update form data to match the saved profile to prevent UI inconsistencies
        setFormData({
          display_name: updatedProfile.display_name || '',
          school: updatedProfile.school || '',
          major: updatedProfile.major || '',
          graduation_year: updatedProfile.graduation_year || new Date().getFullYear() + 4,
          bio: updatedProfile.bio || '',
          campus_location: updatedProfile.campus_location || '',
          is_public: updatedProfile.is_public ?? true
        });
        
        toast({
          title: "Profile updated",
          description: "Your profile has been successfully updated.",
        });

        setIsEditing(false);
        // Close the dialog after successful save
        onOpenChange(false);
      } else {
        console.error('ProfilePage: No updated profile returned');
      }
      
    } catch (error) {
      console.error('ProfilePage: Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    // Reset form data to original profile data
    if (profile) {
      setFormData({
        display_name: profile.display_name || '',
        school: profile.school || '',
        major: profile.major || '',
        graduation_year: profile.graduation_year || new Date().getFullYear() + 4,
        bio: profile.bio || '',
        campus_location: profile.campus_location || '',
        is_public: profile.is_public ?? true
      });
    }
    setIsEditing(false);
  };

  const currentYear = new Date().getFullYear();
  const graduationYears = Array.from({ length: 10 }, (_, i) => currentYear + i);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" hideCloseButton>
        <DialogHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              My Profile
            </DialogTitle>
            <div className="flex items-center gap-2">
              {!isEditing ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2"
                >
                  <Edit2 className="h-4 w-4" />
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                    className="flex items-center gap-2"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={isLoading}
                    className="flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {isLoading ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {formData.is_public ? (
              <>
                <Eye className="h-4 w-4" />
                This is how other users see your profile
              </>
            ) : (
              <>
                <EyeOff className="h-4 w-4" />
                Your profile is private
              </>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Profile Header */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={profile?.avatar_url} />
                  <AvatarFallback className="bg-gradient-to-br from-accent to-primary text-white text-xl">
                    {formData.display_name?.charAt(0)?.toUpperCase() || 
                     user?.email?.charAt(0)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 space-y-3">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="display_name">Display Name</Label>
                        <Input
                          id="display_name"
                          value={formData.display_name}
                          onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                          placeholder="Enter your display name"
                        />
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="is_public"
                          checked={formData.is_public}
                          onCheckedChange={(checked) => setFormData({ ...formData, is_public: checked })}
                        />
                        <Label htmlFor="is_public">Make profile public</Label>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-xl font-semibold text-foreground">
                        {formData.display_name || user?.email?.split('@')[0] || 'User'}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {user?.email}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Academic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Academic Information
              </CardTitle>
              <CardDescription>
                Your academic details visible to other students
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="school">School</Label>
                    <FloatingActionPanelRoot>
                      {({ closePanel }) => (
                        <>
                          <FloatingActionPanelTrigger 
                            title="Select School" 
                            mode="actions"
                            className="w-full justify-start"
                          >
                            {formData.school || "Select your school"}
                          </FloatingActionPanelTrigger>
                          
                          <FloatingActionPanelContent className="w-[300px]">
                            <ScrollArea className="h-[300px]">
                              <div className="space-y-1 p-2">
                                {universities.map((university) => (
                                  <FloatingActionPanelButton
                                    key={university.id}
                                    onClick={() => {
                                      setFormData({ ...formData, school: university.name });
                                      closePanel();
                                    }}
                                    className={formData.school === university.name ? "bg-accent" : ""}
                                  >
                                    {university.name}
                                  </FloatingActionPanelButton>
                                ))}
                              </div>
                            </ScrollArea>
                          </FloatingActionPanelContent>
                        </>
                      )}
                    </FloatingActionPanelRoot>
                  </div>

                  <div>
                    <Label htmlFor="major">Major</Label>
                    <FloatingActionPanelRoot>
                      {({ closePanel }) => (
                        <>
                          <FloatingActionPanelTrigger 
                            title="Select Major" 
                            mode="actions"
                            className="w-full justify-start"
                          >
                            {formData.major || "Select your major"}
                          </FloatingActionPanelTrigger>
                          
                          <FloatingActionPanelContent className="w-[300px]">
                            <ScrollArea className="h-[300px]">
                              <div className="space-y-1 p-2">
                                {collegeMajors.map((major) => (
                                  <FloatingActionPanelButton
                                    key={major}
                                    onClick={() => {
                                      setFormData({ ...formData, major: major });
                                      closePanel();
                                    }}
                                    className={formData.major === major ? "bg-accent" : ""}
                                  >
                                    {major}
                                  </FloatingActionPanelButton>
                                ))}
                              </div>
                            </ScrollArea>
                          </FloatingActionPanelContent>
                        </>
                      )}
                    </FloatingActionPanelRoot>
                  </div>

                  <div>
                    <Label htmlFor="graduation_year">Graduation Year</Label>
                    <FloatingActionPanelRoot>
                      {({ closePanel }) => (
                        <>
                          <FloatingActionPanelTrigger 
                            title="Select Graduation Year" 
                            mode="actions"
                            className="w-full justify-start"
                          >
                            {formData.graduation_year || "Select graduation year"}
                          </FloatingActionPanelTrigger>
                          
                          <FloatingActionPanelContent className="w-[200px]">
                            <div className="space-y-1 p-2">
                              {graduationYears.map((year) => (
                                <FloatingActionPanelButton
                                  key={year}
                                  onClick={() => {
                                    setFormData({ ...formData, graduation_year: year });
                                    closePanel();
                                  }}
                                  className={formData.graduation_year === year ? "bg-accent" : ""}
                                >
                                  {year}
                                </FloatingActionPanelButton>
                              ))}
                            </div>
                          </FloatingActionPanelContent>
                        </>
                      )}
                    </FloatingActionPanelRoot>
                  </div>

                  <div>
                    <Label htmlFor="campus_location">Campus Location</Label>
                    <Input
                      id="campus_location"
                      value={formData.campus_location}
                      onChange={(e) => setFormData({ ...formData, campus_location: e.target.value })}
                      placeholder="e.g., Main Campus, Downtown"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <School className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {formData.school ? (
                        <Badge variant="secondary">{formData.school}</Badge>
                      ) : (
                        <span className="text-muted-foreground">No school selected</span>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {formData.major ? (
                        <Badge variant="outline">{formData.major}</Badge>
                      ) : (
                        <span className="text-muted-foreground">No major selected</span>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {formData.graduation_year ? (
                        <Badge variant="secondary">Class of {formData.graduation_year}</Badge>
                      ) : (
                        <span className="text-muted-foreground">No graduation year</span>
                      )}
                    </span>
                  </div>

                  {formData.campus_location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{formData.campus_location}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bio Section */}
          <Card>
            <CardHeader>
              <CardTitle>About Me</CardTitle>
              <CardDescription>
                Tell other students about yourself
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <div>
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder="Write a short bio about yourself..."
                    className="min-h-[100px]"
                  />
                </div>
              ) : (
                <div className="text-sm">
                  {formData.bio ? (
                    <p className="text-foreground whitespace-pre-wrap">{formData.bio}</p>
                  ) : (
                    <p className="text-muted-foreground italic">No bio added yet</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Social Media Links */}
          {profile?.social_links && typeof profile.social_links === 'object' && Object.keys(profile.social_links).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Connect</CardTitle>
                <CardDescription>
                  My social media profiles
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries((profile.social_links || {}) as Record<string, string>).map(([platform, url]) => {
                    if (!url || typeof url !== 'string') return null;
                    
                    const Icon = getPlatformIcon(platform);
                    const username = extractUsername(url, platform);
                    const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
                    
                    return (
                      <a
                        key={platform}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors group"
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getPlatformColor(platform)}`}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        
                        <div className="flex-1 flex items-center gap-2">
                          <span className="text-sm font-medium text-muted-foreground">
                            {platformName}
                          </span>
                          <span className="text-sm text-foreground">
                            @{username || 'user'}
                          </span>
                        </div>
                        
                        <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Spotify Section - Only shows when connected and playing */}
          {user?.id === profile?.user_id && (
            <SpotifyNowPlayingCard userId={user.id} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};