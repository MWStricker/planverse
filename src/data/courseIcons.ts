import { 
  BookOpen, Calculator, Microscope, Heart, Music, Palette, Globe, 
  Code, Beaker, Drama, Camera, PenTool, Trophy, Target, Zap,
  Brain, Atom, Stethoscope, Dumbbell, Mic, Brush, Map,
  Laptop, TestTube, Theater, Aperture, Edit3, Award, Crosshair, 
  Lightbulb, Cpu, Gamepad2, LucideIcon
} from "lucide-react";

export interface CourseIcon {
  id: string;
  name: string;
  icon: LucideIcon;
  category: string;
}

export const courseIcons: CourseIcon[] = [
  // Academic/General
  { id: 'book-open', name: 'Book', icon: BookOpen, category: 'Academic' },
  { id: 'brain', name: 'Brain', icon: Brain, category: 'Academic' },
  { id: 'lightbulb', name: 'Lightbulb', icon: Lightbulb, category: 'Academic' },
  { id: 'award', name: 'Award', icon: Award, category: 'Academic' },
  { id: 'trophy', name: 'Trophy', icon: Trophy, category: 'Academic' },

  // Mathematics/Engineering
  { id: 'calculator', name: 'Calculator', icon: Calculator, category: 'Mathematics' },
  { id: 'cpu', name: 'CPU', icon: Cpu, category: 'Mathematics' },
  { id: 'zap', name: 'Electric', icon: Zap, category: 'Mathematics' },
  { id: 'target', name: 'Target', icon: Target, category: 'Mathematics' },
  { id: 'crosshair', name: 'Crosshair', icon: Crosshair, category: 'Mathematics' },

  // Science/Lab
  { id: 'microscope', name: 'Microscope', icon: Microscope, category: 'Science' },
  { id: 'beaker', name: 'Beaker', icon: Beaker, category: 'Science' },
  { id: 'test-tube', name: 'Test Tube', icon: TestTube, category: 'Science' },
  { id: 'atom', name: 'Atom', icon: Atom, category: 'Science' },

  // Health/Medical
  { id: 'heart', name: 'Heart', icon: Heart, category: 'Health' },
  { id: 'stethoscope', name: 'Stethoscope', icon: Stethoscope, category: 'Health' },
  { id: 'dumbbell', name: 'Fitness', icon: Dumbbell, category: 'Health' },

  // Arts/Creative
  { id: 'music', name: 'Music', icon: Music, category: 'Arts' },
  { id: 'palette', name: 'Palette', icon: Palette, category: 'Arts' },
  { id: 'brush', name: 'Brush', icon: Brush, category: 'Arts' },
  { id: 'drama', name: 'Drama', icon: Drama, category: 'Arts' },
  { id: 'theatre', name: 'Theater', icon: Theater, category: 'Arts' },
  { id: 'microphone', name: 'Microphone', icon: Mic, category: 'Arts' },
  { id: 'camera', name: 'Camera', icon: Camera, category: 'Arts' },
  { id: 'aperture', name: 'Aperture', icon: Aperture, category: 'Arts' },

  // Technology/Computer Science
  { id: 'laptop', name: 'Laptop', icon: Laptop, category: 'Technology' },
  { id: 'code', name: 'Code', icon: Code, category: 'Technology' },
  { id: 'gamepad', name: 'Gaming', icon: Gamepad2, category: 'Technology' },

  // Geography/Social Studies
  { id: 'globe', name: 'Globe', icon: Globe, category: 'Geography' },
  { id: 'map', name: 'Map', icon: Map, category: 'Geography' },

  // Writing/Literature
  { id: 'pen-tool', name: 'Pen', icon: PenTool, category: 'Writing' },
  { id: 'edit', name: 'Edit', icon: Edit3, category: 'Writing' },
];

export const getCourseIconById = (id: string): LucideIcon => {
  const iconData = courseIcons.find(icon => icon.id === id);
  return iconData?.icon || BookOpen;
};

export const getCourseIconCategories = (): string[] => {
  const categories = courseIcons.map(icon => icon.category);
  return Array.from(new Set(categories));
};