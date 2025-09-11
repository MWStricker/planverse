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
  4: { // Critical
    label: 'Critical',
    color: 'bg-destructive',
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/20',
    textColor: 'text-destructive',
    icon: AlertTriangle,
    badgeVariant: 'destructive',
    emoji: '🚨'
  },
  3: { // High
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

export const getPriorityIcon = (priority: number) => {
  const config = getPriorityConfig(priority);
  const IconComponent = config.icon;
  return IconComponent;
};

export const getPriorityEmoji = (priority: number): string => {
  return getPriorityConfig(priority).emoji;
};