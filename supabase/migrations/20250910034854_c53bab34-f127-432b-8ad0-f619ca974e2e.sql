-- Remove duplicate study sessions for September 9th
DELETE FROM study_sessions 
WHERE user_id = '48635c24-cb68-4b1c-8533-7a81576c6701' 
  AND title = 'Morning Focus' 
  AND start_time::date = '2025-09-09';