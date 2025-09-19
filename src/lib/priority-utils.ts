import { AlertTriangle, Clock, BookOpen, CheckCircle, Circle } from "lucide-react";

export interface PriorityConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  icon: any;
  badgeVariant: "default" | "destructive" | "secondary" | "outline";
  emoji: string;
}

export const PRIORITY_CONFIG: Record<number, PriorityConfig> = {
  3: { // High (was previously level 3, now becomes the highest)
    label: 'High',
    color: 'bg-orange-500',
    bgColor: 'bg-orange-100',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-700',
    icon: Clock,
    badgeVariant: 'default',
    emoji: '⚡'
  },
  2: { // Medium
    label: 'Medium',
    color: 'bg-warning',
    bgColor: 'bg-warning/10',
    borderColor: 'border-warning/20',
    textColor: 'text-warning',
    icon: BookOpen,
    badgeVariant: 'secondary',
    emoji: '📋'
  },
  1: { // Low
    label: 'Low',
    color: 'bg-success',
    bgColor: 'bg-success/10',
    borderColor: 'border-success/20',
    textColor: 'text-success',
    icon: CheckCircle,
    badgeVariant: 'outline',
    emoji: '✅'
  },
  0: { // No Priority
    label: 'No Priority',
    color: 'bg-muted',
    bgColor: 'bg-muted/10',
    borderColor: 'border-muted/20',
    textColor: 'text-muted-foreground',
    icon: Circle,
    badgeVariant: 'outline',
    emoji: '⚪'
  }
};

export const getPriorityConfig = (priority: number): PriorityConfig => {
  return PRIORITY_CONFIG[priority] || PRIORITY_CONFIG[0];
};

export const getPriorityLabel = (priority: number): string => {
  return getPriorityConfig(priority).label;
};

export const getPriorityColor = (priority: number): string => {
  return getPriorityConfig(priority).color;
};

export const getPriorityBadgeVariant = (priority: number): "default" | "destructive" | "secondary" | "outline" => {
  return getPriorityConfig(priority).badgeVariant;
};

export const getPriorityIconComponent = (priority: number) => {
  const config = getPriorityConfig(priority);
  return config.icon;
};

export const getPriorityEmoji = (priority: number): string => {
  return getPriorityConfig(priority).emoji;
};

// High priority keywords for automatic priority detection
const HIGH_PRIORITY_KEYWORDS = [
  'test', 'exam', 'essay', 'quiz', 'midterm', 'final', 'presentation', 
  'project', 'assignment', 'paper', 'thesis', 'dissertation', 'lab report',
  'due', 'deadline', 'submit', 'submission', 'grade', 'graded'
];

/**
 * Analyzes text content and automatically determines priority based on keywords
 * @param title - The title of the task/event
 * @param description - Optional description text
 * @returns Priority level (0-3, where 3 is highest)
 */
export const analyzeTextForPriority = (title: string, description?: string): number => {
  const combinedText = `${title} ${description || ''}`.toLowerCase();
  
  // Check for high priority keywords
  const hasHighPriorityKeyword = HIGH_PRIORITY_KEYWORDS.some(keyword => 
    combinedText.includes(keyword)
  );
  
  if (hasHighPriorityKeyword) {
    return 3; // High priority
  }
  
  // Check for medium priority indicators
  const mediumPriorityKeywords = ['homework', 'reading', 'study', 'review', 'practice'];
  const hasMediumPriorityKeyword = mediumPriorityKeywords.some(keyword =>
    combinedText.includes(keyword)
  );
  
  if (hasMediumPriorityKeyword) {
    return 2; // Medium priority
  }
  
  // Default to low priority
  return 1;
};