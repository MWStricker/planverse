-- Create table to store Canvas course color mappings
CREATE TABLE public.course_colors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  course_code TEXT NOT NULL,
  canvas_color TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, course_code)
);

-- Enable Row Level Security
ALTER TABLE public.course_colors ENABLE ROW LEVEL SECURITY;

-- Create policies for course colors
CREATE POLICY "Users can manage their own course colors" 
ON public.course_colors 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_course_colors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_course_colors_updated_at
BEFORE UPDATE ON public.course_colors
FOR EACH ROW
EXECUTE FUNCTION public.update_course_colors_updated_at();