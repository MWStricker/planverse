-- SECURITY FIX: Remove email exposure from profiles table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;

-- SECURITY FIX: Restrict user_presence visibility to friends only
DROP POLICY IF EXISTS "Users can view all user presence" ON public.user_presence;

-- Users can see their own presence
CREATE POLICY "Users can view their own presence"
ON public.user_presence
FOR SELECT
USING (auth.uid() = user_id);

-- Users can see their friends' presence
CREATE POLICY "Users can view friends presence"
ON public.user_presence
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.friendships
    WHERE (user1_id = auth.uid() AND user2_id = user_presence.user_id)
       OR (user2_id = auth.uid() AND user1_id = user_presence.user_id)
  )
);

-- SECURITY FIX: Update function to include proper search_path
CREATE OR REPLACE FUNCTION public.update_user_presence()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;