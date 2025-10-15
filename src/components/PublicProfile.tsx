import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SpotifyNowPlayingCard } from '@/components/SpotifyNowPlayingCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { School, MapPin, Calendar, User, MessageCircle, Instagram, Ghost, Tv, MessageSquare, Twitter, Youtube, Link, ExternalLink } from 'lucide-react';
import { PublicProfile as PublicProfileType } from '@/hooks/useConnect';

const getPlatformIcon = (platform: string) => {
  const icons: Record<string, any> = {
    instagram: Instagram,
    snapchat: Ghost,
    twitch: Tv,
    discord: MessageSquare,
    twitter: Twitter,
    youtube: Youtube
  };
  return icons[platform.toLowerCase()] || Link;
};

const extractUsername = (url: string, platform: string): string | null => {
  if (!url || typeof url !== 'string') return null;
  
  const patterns: Record<string, RegExp> = {
    instagram: /instagram\.com\/([a-zA-Z0-9_.]+)/,
    snapchat: /snapchat\.com\/add\/([a-zA-Z0-9_.]+)/,
    twitch: /twitch\.tv\/([a-zA-Z0-9_]+)/,
    discord: /discord\.(gg|com)\/([a-zA-Z0-9_]+)/,
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
    discord: 'bg-indigo-600',
    twitter: 'bg-sky-500',
    snapchat: 'bg-yellow-400'
  };
  return colors[platform.toLowerCase()] || 'bg-gray-500';
};

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
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
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

          {/* Social Media Links */}
          {profile.social_links && typeof profile.social_links === 'object' && profile.social_links !== null && Object.keys(profile.social_links).length > 0 && (
            <div>
              <h3 className="font-semibold text-foreground mb-3">Connect</h3>
              <div className="space-y-2">
                {Object.entries(profile.social_links || {}).map(([platform, url]) => {
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
            </div>
          )}
          
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