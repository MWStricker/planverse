import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface UserStatusIndicatorProps {
  status: 'online' | 'idle' | 'dnd' | 'offline';
  isCurrentUser?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const UserStatusIndicator = ({ 
  status, 
  isCurrentUser = false, 
  size = 'md' 
}: UserStatusIndicatorProps) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const { user } = useAuth();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'idle':
        return 'bg-orange-500';
      case 'dnd':
        return 'bg-red-500';
      case 'offline':
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'online':
        return 'Online';
      case 'idle':
        return 'Idle';
      case 'dnd':
        return 'Do Not Disturb';
      case 'offline':
      default:
        return 'Offline';
    }
  };

  const getSizeClass = (size: string) => {
    switch (size) {
      case 'sm':
        return 'w-2 h-2';
      case 'lg':
        return 'w-4 h-4';
      case 'md':
      default:
        return 'w-3 h-3';
    }
  };

  const updateStatus = async (newStatus: 'online' | 'idle' | 'dnd' | 'offline') => {
    if (!user?.id || isUpdating) return;
    
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('user_presence')
        .upsert({
          user_id: user.id,
          status: newStatus,
          last_seen: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error updating status:', error);
      }
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const statusDot = (
    <div 
      className={`rounded-full border-2 border-border/30 ${getStatusColor(status)} ${getSizeClass(size)} transition-all duration-200`}
      title={getStatusLabel(status)}
    />
  );

  // If this is not the current user's status, just show the dot
  if (!isCurrentUser) {
    return statusDot;
  }

  // If this is the current user, make it clickable with dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="p-1 h-auto hover:bg-muted/50 rounded-md border border-transparent hover:border-border/50 transition-all duration-200 group"
          disabled={isUpdating}
        >
          <div 
            className={`rounded-full border-2 border-border/30 group-hover:border-gray-400 group-hover:bg-gray-400 ${!isUpdating ? getStatusColor(status) : 'bg-gray-400'} ${getSizeClass(size)} transition-all duration-200`}
            title={isUpdating ? 'Updating...' : `Click to change status (Currently: ${getStatusLabel(status)})`}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem onClick={() => updateStatus('online')}>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>Online</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => updateStatus('idle')}>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span>Idle</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => updateStatus('dnd')}>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>Do Not Disturb</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => updateStatus('offline')}>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-400" />
            <span>Offline</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};