-- Add recurring task support to tasks table
ALTER TABLE public.tasks 
ADD COLUMN recurrence_type text,
ADD COLUMN recurrence_pattern jsonb DEFAULT '{}'::jsonb,
ADD COLUMN parent_task_id uuid REFERENCES public.tasks(id),
ADD COLUMN is_recurring boolean DEFAULT false;