-- Create post_views table for tracking individual views
CREATE TABLE post_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  viewer_school TEXT,
  viewer_major TEXT,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_unique_view BOOLEAN DEFAULT true,
  session_duration INTEGER DEFAULT 0
);

CREATE INDEX idx_post_views_post_id ON post_views(post_id);
CREATE INDEX idx_post_views_viewed_at ON post_views(viewed_at);
CREATE INDEX idx_post_views_viewer_id ON post_views(viewer_id);

-- Enable RLS
ALTER TABLE post_views ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view analytics for their own posts
CREATE POLICY "Users can view their post views"
  ON post_views FOR SELECT
  USING (
    post_id IN (
      SELECT id FROM posts WHERE user_id = auth.uid()
    )
  );

-- Policy: System can insert view records
CREATE POLICY "System can insert post views"
  ON post_views FOR INSERT
  WITH CHECK (true);

-- Function: Get Analytics Summary
CREATE OR REPLACE FUNCTION get_post_analytics_summary(
  p_user_id UUID,
  p_time_range INTERVAL DEFAULT '30 days'
)
RETURNS TABLE (
  total_posts INTEGER,
  total_impressions BIGINT,
  total_engagement BIGINT,
  avg_engagement_rate NUMERIC,
  active_promotions INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT p.id)::INTEGER as total_posts,
    COALESCE(SUM(pa.impressions), 0)::BIGINT as total_impressions,
    COALESCE(SUM(pa.likes + pa.comments + pa.shares), 0)::BIGINT as total_engagement,
    CASE 
      WHEN SUM(pa.impressions) > 0 THEN 
        ROUND((SUM(pa.likes + pa.comments + pa.shares)::NUMERIC / SUM(pa.impressions) * 100), 2)
      ELSE 0 
    END as avg_engagement_rate,
    (SELECT COUNT(*)::INTEGER FROM promoted_posts WHERE user_id = p_user_id AND status = 'active')
  FROM posts p
  LEFT JOIN post_analytics pa ON p.id = pa.post_id
  WHERE p.user_id = p_user_id
    AND (pa.date >= CURRENT_DATE - p_time_range OR pa.date IS NULL);
END;
$$;

-- Function: Get Individual Post Analytics
CREATE OR REPLACE FUNCTION get_individual_post_analytics(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  post_id UUID,
  post_content TEXT,
  post_image_url TEXT,
  post_created_at TIMESTAMP WITH TIME ZONE,
  is_promoted BOOLEAN,
  total_impressions BIGINT,
  total_clicks BIGINT,
  total_likes BIGINT,
  total_comments BIGINT,
  total_shares BIGINT,
  engagement_rate NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.content,
    p.image_url,
    p.created_at,
    p.is_promoted,
    COALESCE(SUM(pa.impressions), 0)::BIGINT,
    COALESCE(SUM(pa.clicks), 0)::BIGINT,
    COALESCE(SUM(pa.likes), 0)::BIGINT,
    COALESCE(SUM(pa.comments), 0)::BIGINT,
    COALESCE(SUM(pa.shares), 0)::BIGINT,
    CASE 
      WHEN SUM(pa.impressions) > 0 THEN 
        ROUND((SUM(pa.likes + pa.comments + pa.shares)::NUMERIC / SUM(pa.impressions) * 100), 2)
      ELSE 0 
    END
  FROM posts p
  LEFT JOIN post_analytics pa ON p.id = pa.post_id
  WHERE p.user_id = p_user_id
  GROUP BY p.id, p.content, p.image_url, p.created_at, p.is_promoted
  ORDER BY p.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Function: Get Time-Series Data for Charts
CREATE OR REPLACE FUNCTION get_analytics_timeseries(
  p_user_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  date DATE,
  impressions BIGINT,
  engagement BIGINT,
  clicks BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pa.date,
    COALESCE(SUM(pa.impressions), 0)::BIGINT,
    COALESCE(SUM(pa.likes + pa.comments + pa.shares), 0)::BIGINT,
    COALESCE(SUM(pa.clicks), 0)::BIGINT
  FROM post_analytics pa
  INNER JOIN posts p ON pa.post_id = p.id
  WHERE p.user_id = p_user_id
    AND pa.date >= CURRENT_DATE - (p_days || ' days')::INTERVAL
  GROUP BY pa.date
  ORDER BY pa.date ASC;
END;
$$;

-- Function: Upsert Daily Analytics
CREATE OR REPLACE FUNCTION upsert_daily_analytics(
  p_post_id UUID,
  p_date DATE,
  p_increment_impressions INTEGER DEFAULT 0,
  p_increment_clicks INTEGER DEFAULT 0,
  p_increment_likes INTEGER DEFAULT 0,
  p_increment_comments INTEGER DEFAULT 0,
  p_increment_shares INTEGER DEFAULT 0,
  p_viewer_school TEXT DEFAULT NULL,
  p_viewer_major TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_existing_schools JSONB;
  v_existing_majors JSONB;
BEGIN
  -- Get post owner
  SELECT user_id INTO v_user_id FROM posts WHERE id = p_post_id;
  
  -- Get existing demographics or initialize empty objects
  SELECT 
    COALESCE(viewer_schools, '{}'::jsonb),
    COALESCE(viewer_majors, '{}'::jsonb)
  INTO v_existing_schools, v_existing_majors
  FROM post_analytics
  WHERE post_id = p_post_id AND date = p_date;
  
  -- Initialize if null
  IF v_existing_schools IS NULL THEN
    v_existing_schools = '{}'::jsonb;
  END IF;
  IF v_existing_majors IS NULL THEN
    v_existing_majors = '{}'::jsonb;
  END IF;
  
  -- Add new demographics if provided
  IF p_viewer_school IS NOT NULL THEN
    v_existing_schools = jsonb_set(
      v_existing_schools, 
      ARRAY[p_viewer_school]::text[], 
      to_jsonb(COALESCE((v_existing_schools->p_viewer_school)::int, 0) + 1)
    );
  END IF;
  
  IF p_viewer_major IS NOT NULL THEN
    v_existing_majors = jsonb_set(
      v_existing_majors, 
      ARRAY[p_viewer_major]::text[], 
      to_jsonb(COALESCE((v_existing_majors->p_viewer_major)::int, 0) + 1)
    );
  END IF;
  
  -- Upsert analytics record
  INSERT INTO post_analytics (
    post_id,
    user_id,
    date,
    impressions,
    clicks,
    likes,
    comments,
    shares,
    viewer_schools,
    viewer_majors
  ) VALUES (
    p_post_id,
    v_user_id,
    p_date,
    p_increment_impressions,
    p_increment_clicks,
    p_increment_likes,
    p_increment_comments,
    p_increment_shares,
    v_existing_schools,
    v_existing_majors
  )
  ON CONFLICT (post_id, date) DO UPDATE SET
    impressions = post_analytics.impressions + p_increment_impressions,
    clicks = post_analytics.clicks + p_increment_clicks,
    likes = post_analytics.likes + p_increment_likes,
    comments = post_analytics.comments + p_increment_comments,
    shares = post_analytics.shares + p_increment_shares,
    viewer_schools = v_existing_schools,
    viewer_majors = v_existing_majors,
    updated_at = now();
END;
$$;

-- Enable realtime replication
ALTER PUBLICATION supabase_realtime ADD TABLE post_analytics;
ALTER PUBLICATION supabase_realtime ADD TABLE promoted_posts;

-- Set replica identity
ALTER TABLE post_analytics REPLICA IDENTITY FULL;
ALTER TABLE promoted_posts REPLICA IDENTITY FULL;