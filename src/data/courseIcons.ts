import { 
  BookOpen, Calculator, Microscope, Heart, Music, Palette, Globe, 
  Code, Beaker, Drama, Camera, PenTool, Trophy, Target, Zap,
  Brain, Atom, Stethoscope, Dumbbell, Mic, Brush, Map,
  Laptop, TestTube, Theater, Aperture, Edit3, Award, Crosshair, 
  Lightbulb, Cpu, Gamepad2, LucideIcon, GraduationCap, School,
  Users, ChefHat, Hammer, Wrench, Plane, Car, Building,
  TreePine, Leaf, Recycle, Sun, Star, Moon, LucideIcon as IconType
} from "lucide-react";

export interface CourseIcon {
  id: string;
  name: string;
  icon: IconType;
  category: string;
}

export const courseIcons: CourseIcon[] = [
  // Core Academic
  { id: 'book-open', name: 'Book', icon: BookOpen, category: 'Academic' },
  { id: 'graduation-cap', name: 'Graduation', icon: GraduationCap, category: 'Academic' },
  { id: 'school', name: 'School', icon: School, category: 'Academic' },
  { id: 'brain', name: 'Brain', icon: Brain, category: 'Academic' },
  { id: 'lightbulb', name: 'Ideas', icon: Lightbulb, category: 'Academic' },

  // Mathematics & Sciences
  { id: 'calculator', name: 'Calculator', icon: Calculator, category: 'Mathematics' },
  { id: 'microscope', name: 'Microscope', icon: Microscope, category: 'Science' },
  { id: 'beaker', name: 'Chemistry', icon: Beaker, category: 'Science' },
  { id: 'test-tube', name: 'Lab', icon: TestTube, category: 'Science' },
  { id: 'atom', name: 'Physics', icon: Atom, category: 'Science' },

  // Health & Wellness
  { id: 'heart', name: 'Health', icon: Heart, category: 'Health' },
  { id: 'stethoscope', name: 'Medicine', icon: Stethoscope, category: 'Health' },
  { id: 'dumbbell', name: 'Fitness', icon: Dumbbell, category: 'Health' },

  // Arts & Creative
  { id: 'music', name: 'Music', icon: Music, category: 'Arts' },
  { id: 'palette', name: 'Art', icon: Palette, category: 'Arts' },
  { id: 'brush', name: 'Painting', icon: Brush, category: 'Arts' },
  { id: 'theater', name: 'Theater', icon: Theater, category: 'Arts' },
  { id: 'camera', name: 'Photography', icon: Camera, category: 'Arts' },
  { id: 'mic', name: 'Audio', icon: Mic, category: 'Arts' },

  // Technology & Engineering
  { id: 'laptop', name: 'Computer', icon: Laptop, category: 'Technology' },
  { id: 'code', name: 'Programming', icon: Code, category: 'Technology' },
  { id: 'cpu', name: 'Engineering', icon: Cpu, category: 'Technology' },
  { id: 'zap', name: 'Electronics', icon: Zap, category: 'Technology' },

  // Social Sciences & Humanities
  { id: 'globe', name: 'Geography', icon: Globe, category: 'Social Studies' },
  { id: 'map', name: 'History', icon: Map, category: 'Social Studies' },
  { id: 'users', name: 'Sociology', icon: Users, category: 'Social Studies' },

  // Language & Communication
  { id: 'pen-tool', name: 'Writing', icon: PenTool, category: 'Language' },
  { id: 'edit', name: 'Literature', icon: Edit3, category: 'Language' },

  // Achievement & Goals
  { id: 'trophy', name: 'Achievement', icon: Trophy, category: 'Goals' },
  { id: 'award', name: 'Excellence', icon: Award, category: 'Goals' },
  { id: 'target', name: 'Goals', icon: Target, category: 'Goals' },
  
  // Additional Academic
  { id: 'star', name: 'Star', icon: Star, category: 'Academic' },
  { id: 'gamepad', name: 'Gaming', icon: Gamepad2, category: 'Technology' },
  
  // Business & Economics 
  { id: 'building', name: 'Business', icon: Building, category: 'Business' },
  { id: 'aperture', name: 'Focus', icon: Aperture, category: 'Academic' },
  { id: 'crosshair', name: 'Precision', icon: Crosshair, category: 'Academic' },
];

export const getCourseIconById = (id: string): IconType => {
  const iconData = courseIcons.find(icon => icon.id === id);
  return iconData?.icon || BookOpen;
};

export const getCourseIconCategories = (): string[] => {
  const categories = courseIcons.map(icon => icon.category);
  return Array.from(new Set(categories));
};