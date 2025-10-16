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
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { postId, budget, durationDays, skipPayment, promotionConfig } = await req.json();

    console.log('Creating promotion:', { postId, budget, durationDays, skipPayment, promotionConfig, userId: user.id });

    // Validate inputs
    if (!postId || !budget || !durationDays) {
      throw new Error('Missing required fields');
    }

    if (budget < 5 || budget > 1000) {
      throw new Error('Budget must be between $5 and $1000');
    }

    // Verify user owns the post
    const { data: post, error: postError } = await supabaseClient
      .from('posts')
      .select('id, user_id')
      .eq('id', postId)
      .single();

    if (postError || !post) {
      throw new Error('Post not found');
    }

    if (post.user_id !== user.id) {
      throw new Error('You can only promote your own posts');
    }

    // Check if post is already promoted
    const { data: existingPromotion } = await supabaseClient
      .from('promoted_posts')
      .select('id')
      .eq('post_id', postId)
      .single();

    if (existingPromotion) {
      throw new Error('This post is already promoted');
    }

    // Check if user has professional account
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('account_type')
      .eq('user_id', user.id)
      .single();

    if (!profile || !profile.account_type?.startsWith('professional_')) {
      throw new Error('Professional account required to promote posts');
    }

    // Create promoted post record (pending payment)
    const { data: promotedPost, error: promotionError } = await supabaseClient
      .from('promoted_posts')
      .insert({
        post_id: postId,
        user_id: user.id,
        promotion_budget: budget,
        promotion_duration_days: durationDays,
        payment_status: 'pending',
        status: 'pending',
        moderation_status: 'pending',
        target_impressions: Math.floor(budget * 100 * (1 + durationDays / 10)),
        promotion_config: promotionConfig || {},
      })
      .select()
      .single();

    if (promotionError) {
      console.error('Error creating promotion:', promotionError);
      throw new Error('Failed to create promotion');
    }

    console.log('Promotion created successfully:', promotedPost.id);

    // If skipPayment is true, activate immediately for testing
    if (skipPayment) {
      // Calculate priority score
      const budgetScore = Math.min((budget / 500) * 50, 50);
      const durationScore = Math.min((durationDays / 30) * 50, 50);
      const priorityScore = Math.round(budgetScore + durationScore);

      const now = new Date();
      const endsAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

      // Update promotion to active
      await supabaseClient
        .from('promoted_posts')
        .update({
          payment_status: 'completed',
          status: 'active',
          moderation_status: 'approved',
          starts_at: now.toISOString(),
          ends_at: endsAt.toISOString(),
        })
        .eq('id', promotedPost.id);

      // Update post with promotion priority
      await supabaseClient
        .from('posts')
        .update({
          is_promoted: true,
          promotion_priority: priorityScore,
        })
        .eq('id', postId);

      console.log('Promotion activated with priority:', priorityScore);

      return new Response(
        JSON.stringify({
          success: true,
          promotionId: promotedPost.id,
          message: 'Promotion activated successfully',
          priorityScore
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // TODO: Create Stripe Payment Intent here
    // For now, return success without actual payment
    // const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '');
    // const paymentIntent = await stripe.paymentIntents.create({...});

    return new Response(
      JSON.stringify({
        success: true,
        promotionId: promotedPost.id,
        // clientSecret: paymentIntent.client_secret, // Add when Stripe is integrated
        message: 'Promotion created and pending approval'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in create-promotion:', error);
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
