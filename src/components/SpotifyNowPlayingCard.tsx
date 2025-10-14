import React from 'react';
import { useSpotify } from '@/hooks/useSpotify';
import { SpotifyNowPlaying } from '@/components/SpotifyNowPlaying';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SpotifyNowPlayingCardProps {
  userId: string;
  isPublicProfile?: boolean;
}

export const SpotifyNowPlayingCard: React.FC<SpotifyNowPlayingCardProps> = ({ 
  userId, 
  isPublicProfile = false 
}) => {
  const { isConnected, nowPlaying, loading } = useSpotify(userId);

  // Don't render anything while loading
  if (loading) return null;

  // Don't render if not connected or not playing
  if (!isConnected || !nowPlaying || !nowPlaying.isPlaying) {
    return null;
  }

  // Render for public profiles (in PublicProfile component)
  if (isPublicProfile) {
    return (
      <div className="space-y-3">
        <h3 className="font-semibold text-foreground">Currently Listening</h3>
        <SpotifyNowPlaying userId={userId} />
      </div>
    );
  }

  // Render for own profile (in ProfilePage component)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🎵 Currently Listening
        </CardTitle>
        <CardDescription>
          Your Spotify listening activity
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SpotifyNowPlaying userId={userId} />
      </CardContent>
    </Card>
  );
};
