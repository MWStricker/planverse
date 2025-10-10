-- Add phone column to user_accounts table
ALTER TABLE public.user_accounts ADD COLUMN phone text;

-- Create unique index on phone (only for non-null values)
CREATE UNIQUE INDEX idx_user_accounts_phone ON public.user_accounts(phone) WHERE phone IS NOT NULL;

-- Update trigger to copy phone number from auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.user_accounts (user_id, email, phone, last_sign_in_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.phone,
    NEW.last_sign_in_at
  );
  RETURN NEW;
END;
$$;