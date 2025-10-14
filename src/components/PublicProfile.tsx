import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SpotifyNowPlayingCard } from '@/components/SpotifyNowPlayingCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { School, MapPin, Calendar, User, MessageCircle } from 'lucide-react';
import { PublicProfile as PublicProfileType } from '@/hooks/useConnect';

interface PublicProfileProps {
  profile: PublicProfileType;
  onSendMessage?: () => void;
  onAddFriend?: () => void;
}

export const PublicProfile: React.FC<PublicProfileProps> = ({ 
  profile, 
  onSendMessage, 
  onAddFriend 
}) => {
  return (
    <div className="max-w-2xl mx-auto p-6 rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-col space-y-1.5 p-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={profile.avatar_url} />
            <AvatarFallback className="text-lg">
              {profile.display_name?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <CardTitle className="text-2xl">
              {profile.display_name || 'Unknown User'}
            </CardTitle>
            <div className="flex flex-wrap gap-2 mt-2">
              {profile.school && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <School className="h-3 w-3" />
                  {profile.school}
                </Badge>
              )}
              {profile.major && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {profile.major}
                </Badge>
              )}
              {profile.graduation_year && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Class of {profile.graduation_year}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-6 pt-0 space-y-4">
          {profile.bio && (
            <div>
              <h3 className="font-semibold text-foreground mb-2">About</h3>
              <p className="text-muted-foreground">{profile.bio}</p>
            </div>
          )}

          {/* Spotify Section - Only shows when connected and playing */}
          <SpotifyNowPlayingCard userId={profile.user_id} isPublicProfile />
          
          <div className="flex gap-2">
            {onSendMessage && (
              <Button variant="default" onClick={onSendMessage} className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                Message
              </Button>
            )}
            {onAddFriend && (
              <Button variant="outline" onClick={onAddFriend} className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Add Friend
              </Button>
          )}
        </div>
      </div>
    </div>
  );
};