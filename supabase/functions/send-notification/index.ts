import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { userId, type, title, message, data } = await req.json();

    console.log('Sending notification:', { userId, type, title, message });

    if (!userId || !type || !title || !message) {
      throw new Error('Missing required fields: userId, type, title, message');
    }

    // Insert notification
    const { error: notificationError } = await supabaseClient
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        message,
        data: data || {},
        read: false
      });

    if (notificationError) throw notificationError;

    console.log('Notification sent successfully');

    // TODO: Add push notification support
    // TODO: Add email notification support (if user opted in)

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in send-notification:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
