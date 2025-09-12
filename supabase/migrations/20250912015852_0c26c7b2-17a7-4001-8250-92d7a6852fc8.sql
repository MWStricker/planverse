-- Fix existing Canvas assignments that are stored with incorrect timezone
-- Convert 23:59:59+00:00 UTC times to 23:59:59 local time for assignments

UPDATE events 
SET 
  start_time = REPLACE(start_time, 'T23:59:59+00:00', 'T23:59:59'),
  end_time = REPLACE(end_time, 'T23:59:59+00:00', 'T23:59:59')
WHERE 
  source_provider = 'canvas' 
  AND (start_time LIKE '%T23:59:59+00:00' OR end_time LIKE '%T23:59:59+00:00');