import React from 'react';
import { Badge } from '@/components/ui/badge';
import { useRealtime } from '@/hooks/useRealtime';

interface OnlineStatusProps {
  userId: string;
  className?: string;
}

export const OnlineStatus: React.FC<OnlineStatusProps> = ({ userId, className = '' }) => {
  const { getUserStatus } = useRealtime();
  const userStatus = getUserStatus(userId);
  
  // Check if user is actually online
  const isOnline = userStatus === 'online';

  if (!isOnline) return null;

  return (
    <div className={`w-2 h-2 bg-green-500 rounded-full ${className}`} title="Online"></div>
  );
};