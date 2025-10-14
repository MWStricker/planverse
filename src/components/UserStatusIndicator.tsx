import { useState } from "react";
import {
  FloatingActionPanelRoot,
  FloatingActionPanelTrigger,
  FloatingActionPanelContent,
  FloatingActionPanelButton,
} from "@/components/ui/floating-action-panel";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface UserStatusIndicatorProps {
  status: 'online' | 'idle' | 'dnd' | 'offline';
  isCurrentUser?: boolean;
  size?: 'sm' | 'md' | 'lg';
  compact?: boolean;
}

export const UserStatusIndicator = ({ 
  status, 
  isCurrentUser = false, 
  size = 'md',
  compact = false
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
      className={`rounded-full border border-background ${getStatusColor(status)} ${getSizeClass(size)}`}
      title={getStatusLabel(status)}
    />
  );

  // If this is not the current user's status, just show the dot
  if (!isCurrentUser) {
    return statusDot;
  }

  // If this is the current user, make it clickable with dropdown
  return (
    <FloatingActionPanelRoot>
      {({ closePanel }) => (
        <>
          <FloatingActionPanelTrigger
            title="Change Status"
            mode="actions"
            className={compact 
              ? "p-0.5 h-auto bg-transparent hover:bg-muted/30 rounded-full border-0 transition-all duration-200"
              : "p-1.5 h-auto bg-muted/20 hover:bg-muted/50 rounded-md border border-border/20 hover:border-border/40 transition-all duration-200"
            }
          >
            {statusDot}
          </FloatingActionPanelTrigger>
          
          <FloatingActionPanelContent className="w-48">
            <div className="space-y-1 p-2">
              <FloatingActionPanelButton 
                onClick={() => { 
                  updateStatus('online'); 
                  closePanel(); 
                }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span>Online</span>
                </div>
              </FloatingActionPanelButton>
              
              <FloatingActionPanelButton 
                onClick={() => { 
                  updateStatus('idle'); 
                  closePanel(); 
                }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  <span>Idle</span>
                </div>
              </FloatingActionPanelButton>
              
              <FloatingActionPanelButton 
                onClick={() => { 
                  updateStatus('dnd'); 
                  closePanel(); 
                }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span>Do Not Disturb</span>
                </div>
              </FloatingActionPanelButton>
              
              <FloatingActionPanelButton 
                onClick={() => { 
                  updateStatus('offline'); 
                  closePanel(); 
                }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-400" />
                  <span>Offline</span>
                </div>
              </FloatingActionPanelButton>
            </div>
          </FloatingActionPanelContent>
        </>
      )}
    </FloatingActionPanelRoot>
  );
};