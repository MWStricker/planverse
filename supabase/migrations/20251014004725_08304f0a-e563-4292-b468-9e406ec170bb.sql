-- Make the Uploads bucket public so message images can be displayed
UPDATE storage.buckets 
SET public = true 
WHERE id = 'Uploads';

-- Allow authenticated users to upload to their own messages folder
CREATE POLICY "Users can upload their own message images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'Uploads' 
  AND (storage.foldername(name))[1] = 'messages'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- Allow authenticated users to view all message images
CREATE POLICY "Users can view all message images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'Uploads' 
  AND (storage.foldername(name))[1] = 'messages'
);