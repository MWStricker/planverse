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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseClient.auth.getUser(token);

    if (!user) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin or moderator
    const { data: roles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const hasPermission = roles?.some(r => r.role === 'admin' || r.role === 'moderator');
    if (!hasPermission) {
      throw new Error('Insufficient permissions');
    }

    const { promotionId, action, notes } = await req.json();

    console.log('Moderating promotion:', { promotionId, action, moderatorId: user.id });

    if (!promotionId || !action || !['approve', 'reject'].includes(action)) {
      throw new Error('Invalid request');
    }

    const { data: promotion, error: fetchError } = await supabaseClient
      .from('promoted_posts')
      .select('*, posts(*)')
      .eq('id', promotionId)
      .single();

    if (fetchError || !promotion) {
      throw new Error('Promotion not found');
    }

    const now = new Date().toISOString();
    const updateData: any = {
      moderation_status: action === 'approve' ? 'approved' : 'rejected',
      moderated_by: user.id,
      moderated_at: now,
      moderation_notes: notes || null,
    };

    if (action === 'approve') {
      updateData.status = 'active';
      updateData.starts_at = now;
      updateData.ends_at = new Date(Date.now() + promotion.promotion_duration_days * 24 * 60 * 60 * 1000).toISOString();
      updateData.payment_status = 'paid'; // Mark as paid when approved

      // Update the post to mark it as promoted
      await supabaseClient
        .from('posts')
        .update({
          is_promoted: true,
          promotion_priority: promotion.promotion_budget / 10 // Higher budget = higher priority
        })
        .eq('id', promotion.post_id);
    } else {
      // Rejected - mark for refund
      updateData.status = 'cancelled';
      updateData.payment_status = 'refunded';
    }

    const { error: updateError } = await supabaseClient
      .from('promoted_posts')
      .update(updateData)
      .eq('id', promotionId);

    if (updateError) {
      throw updateError;
    }

    // Create notification for the post owner
    await supabaseClient
      .from('notifications')
      .insert({
        user_id: promotion.user_id,
        type: action === 'approve' ? 'promotion_approved' : 'promotion_rejected',
        title: action === 'approve' ? 'Promotion Approved!' : 'Promotion Rejected',
        message: action === 'approve' 
          ? 'Your promoted post is now live and reaching more students!'
          : `Your promotion was rejected. ${notes || 'Please review our promotion guidelines.'}`,
        data: { promotionId, postId: promotion.post_id }
      });

    console.log(`Promotion ${action}d successfully`);

    return new Response(
      JSON.stringify({ success: true, action }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in moderate-promotion:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
