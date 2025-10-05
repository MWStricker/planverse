-- Create user_accounts table to track all user accounts
CREATE TABLE IF NOT EXISTS public.user_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_sign_in_at TIMESTAMP WITH TIME ZONE,
  account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'deleted'))
);

-- Enable RLS
ALTER TABLE public.user_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own account"
  ON public.user_accounts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own account"
  ON public.user_accounts
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create function to auto-create user account on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_accounts (user_id, email, last_sign_in_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.last_sign_in_at
  );
  RETURN NEW;
END;
$$;

-- Create trigger for automatic account creation
CREATE TRIGGER on_auth_user_created_account
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_account();

-- Create function to update account timestamps
CREATE OR REPLACE FUNCTION public.update_user_account_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create trigger for timestamp updates
CREATE TRIGGER update_user_accounts_updated_at
  BEFORE UPDATE ON public.user_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_account_timestamp();

-- Backfill existing users from auth.users into user_accounts
INSERT INTO public.user_accounts (user_id, email, last_sign_in_at, created_at)
SELECT 
  id,
  email,
  last_sign_in_at,
  created_at
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;