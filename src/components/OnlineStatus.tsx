import React from 'react';
import { Badge } from '@/components/ui/badge';
import { useRealtime } from '@/hooks/useRealtime';

interface OnlineStatusProps {
  userId: string;
  className?: string;
}

export const OnlineStatus: React.FC<OnlineStatusProps> = ({ userId, className = '' }) => {
  const { onlineUsers } = useRealtime();
  const isOnline = onlineUsers.includes(userId);

  if (!isOnline) return null;

  return (
    <Badge variant="secondary" className={`bg-green-100 text-green-800 text-xs ${className}`}>
      <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
      Online
    </Badge>
  );
};