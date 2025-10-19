import { supabase } from "@/integrations/supabase/client";

/**
 * Toggles pin status for a conversation for the current user.
 * Uses user1_is_pinned or user2_is_pinned based on user position.
 */
export async function togglePin(myId: string, otherId: string, wantPin: boolean) {
  // Ensure consistent ordering: user1_id < user2_id
  const user1 = myId < otherId ? myId : otherId;
  const user2 = myId < otherId ? otherId : myId;
  
  // Determine which column to update based on current user's position
  const column = myId === user1 ? 'user1_is_pinned' : 'user2_is_pinned';
  
  const { error } = await supabase
    .from('conversations')
    .update({ [column]: wantPin })
    .eq('user1_id', user1)
    .eq('user2_id', user2);
  
  if (error) {
    console.error('Error toggling pin:', error);
    throw error;
  }
  
  // Dispatch event to notify useMessaging to refetch
  window.dispatchEvent(new CustomEvent('conversations-changed', { 
    detail: { action: 'pin-toggled', userId: otherId, pinned: wantPin } 
  }));
}
