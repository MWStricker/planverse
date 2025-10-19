-- Phase 1: Make messages.content nullable for image-only messages
ALTER TABLE public.messages 
  ALTER COLUMN content DROP NOT NULL;

-- Phase 2: Storage RLS policies for secure participant-based access

-- INSERT: user can upload only under messages/<uid>/...
CREATE POLICY "uploads insert own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'Uploads'
  AND (storage.foldername(name))[1] = 'messages'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- UPDATE: only your own files
CREATE POLICY "uploads modify own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'Uploads'
  AND (storage.foldername(name))[1] = 'messages'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- DELETE: only your own files
CREATE POLICY "uploads delete own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'Uploads'
  AND (storage.foldername(name))[1] = 'messages'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- SELECT: only if you're a participant of a message that references this file
CREATE POLICY "uploads read if participant"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'Uploads'
  AND EXISTS (
    SELECT 1
    FROM public.messages m
    WHERE m.image_url = storage.objects.name
      AND (m.sender_id = auth.uid() OR m.receiver_id = auth.uid())
  )
);