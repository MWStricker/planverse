import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { postId, viewerId, viewerSchool, viewerMajor } = await req.json();
    
    console.log(`Tracking view for post ${postId} by user ${viewerId}`);
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Check if this is a unique view (not viewed in last 24h)
    const { data: recentView } = await supabaseClient
      .from('post_views')
      .select('id')
      .eq('post_id', postId)
      .eq('viewer_id', viewerId)
      .gte('viewed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .maybeSingle();
    
    const isUniqueView = !recentView;
    
    console.log(`View is ${isUniqueView ? 'unique' : 'duplicate'}`);
    
    // Insert view record
    const { error: insertError } = await supabaseClient.from('post_views').insert({
      post_id: postId,
      viewer_id: viewerId,
      viewer_school: viewerSchool,
      viewer_major: viewerMajor,
      is_unique_view: isUniqueView
    });
    
    if (insertError) {
      console.error('Error inserting view:', insertError);
      throw insertError;
    }
    
    // Update daily analytics
    const today = new Date().toISOString().split('T')[0];
    const { error: rpcError } = await supabaseClient.rpc('upsert_daily_analytics', {
      p_post_id: postId,
      p_date: today,
      p_increment_impressions: isUniqueView ? 1 : 0,
      p_viewer_school: viewerSchool,
      p_viewer_major: viewerMajor
    });
    
    if (rpcError) {
      console.error('Error updating analytics:', rpcError);
      throw rpcError;
    }
    
    console.log(`Successfully tracked view for post ${postId} - Unique: ${isUniqueView}`);
    
    return new Response(
      JSON.stringify({ success: true, isUniqueView }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error tracking post view:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
