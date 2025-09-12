-- Fix Canvas assignment times by converting them to local time
-- The issue is assignments are stored as 23:59:59+00 (UTC) but should be 23:59:59 local time

UPDATE events 
SET 
  start_time = (DATE_TRUNC('day', start_time) + INTERVAL '23 hours 59 minutes 59 seconds')::timestamp without time zone,
  end_time = (DATE_TRUNC('day', end_time) + INTERVAL '23 hours 59 minutes 59 seconds')::timestamp without time zone
WHERE 
  source_provider = 'canvas' 
  AND EXTRACT(hour FROM start_time) = 23 
  AND EXTRACT(minute FROM start_time) = 59
  AND EXTRACT(second FROM start_time) = 59;