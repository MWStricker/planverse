-- Fix existing Canvas assignments that are stored with incorrect timezone
-- Convert 23:59:59+00:00 UTC times to 23:59:59 local time for assignments

UPDATE events 
SET 
  start_time = REPLACE(start_time::text, 'T23:59:59+00', 'T23:59:59')::timestamp with time zone,
  end_time = REPLACE(end_time::text, 'T23:59:59+00', 'T23:59:59')::timestamp with time zone
WHERE 
  source_provider = 'canvas' 
  AND (start_time::text LIKE '%T23:59:59+00%' OR end_time::text LIKE '%T23:59:59+00%');