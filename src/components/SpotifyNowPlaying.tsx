import React from 'react';
import { useSpotify } from '@/hooks/useSpotify';
import { Music, Activity } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface SpotifyNowPlayingProps {
  userId: string;
}

export const SpotifyNowPlaying: React.FC<SpotifyNowPlayingProps> = ({ userId }) => {
  const { nowPlaying, loading, isConnected } = useSpotify(userId);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <div className="flex gap-3">
          <Skeleton className="h-20 w-20 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Music className="h-4 w-4" />
        <p className="text-sm">Not connected to Spotify</p>
      </div>
    );
  }

  if (!nowPlaying || !nowPlaying.isPlaying) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Music className="h-4 w-4" />
        <p className="text-sm">Not listening right now</p>
      </div>
    );
  }

  const progressPercent = (nowPlaying.progress / nowPlaying.duration) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-green-500">
        <Activity className="h-4 w-4 animate-pulse" />
        <span className="text-sm font-medium">Now Playing</span>
      </div>
      
      <div className="flex gap-3">
        {nowPlaying.albumArt && (
          <img
            src={nowPlaying.albumArt}
            alt={`${nowPlaying.album} cover`}
            className="h-20 w-20 rounded-md object-cover shadow-md"
          />
        )}
        
        <div className="flex-1 min-w-0">
          <a
            href={nowPlaying.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-foreground hover:underline line-clamp-1"
          >
            {nowPlaying.song}
          </a>
          <p className="text-sm text-muted-foreground line-clamp-1">
            {nowPlaying.artist}
          </p>
          <p className="text-xs text-muted-foreground line-clamp-1">
            {nowPlaying.album}
          </p>
          
          <div className="mt-2">
            <div className="h-1 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-1000"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-muted-foreground">
              <span>{formatTime(nowPlaying.progress)}</span>
              <span>{formatTime(nowPlaying.duration)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const formatTime = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};
