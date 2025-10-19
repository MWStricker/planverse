import { supabase } from "@/integrations/supabase/client";
import { uploadImageIfAny } from "../uploadImageIfAny";

export interface SendMessageParams {
  text: string;
  file: File | null;
  senderId: string;
  receiverId: string;
  replyToMessageId?: string;
}

export async function sendMessage({
  text,
  file,
  senderId,
  receiverId,
  replyToMessageId,
}: SendMessageParams) {
  const clientMsgId = crypto.randomUUID();

  try {
    // Step 1: Upload image if present (returns storage path or null)
    const imagePath = await uploadImageIfAny(file, clientMsgId, senderId);

    // Step 2: Get or create conversation
    const { data: conversationId, error: convError } = await supabase
      .rpc('get_or_create_conversation', { other_user_id: receiverId });

    if (convError) throw convError;

    // Step 3: Insert message with both text and image
    // Use send_message RPC (already handles idempotency)
    const { data: sentMessage, error: messageError } = await supabase
      .rpc('send_message', {
        p_receiver: receiverId,
        p_content: text?.trim() || null,
        p_image_url: imagePath,
        p_client_id: clientMsgId,
        p_reply_to: replyToMessageId || null
      });

    if (messageError) throw messageError;

    // Step 4: Send notification (optional, but maintaining current behavior)
    try {
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', senderId)
        .single();

      const senderName = senderProfile?.display_name || 'Someone';
      const messagePreview = text.trim() 
        ? text.substring(0, 50) + (text.length > 50 ? '...' : '')
        : 'Sent an image';

      await supabase.functions.invoke('send-notification', {
        body: {
          userId: receiverId,
          type: 'new_message',
          title: `New message from ${senderName}`,
          message: messagePreview,
          data: {
            senderId,
            conversationId,
            hasImage: !!imagePath
          }
        }
      });
    } catch (notificationError) {
      console.error('Error sending notification:', notificationError);
      // Don't fail the whole send if notification fails
    }

    return { 
      success: true, 
      clientMsgId, 
      imagePath,
      conversationId 
    };
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}
