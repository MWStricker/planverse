export interface WeeklyAssignment {
  id: string;
  title: string;
  dueDate: Date;
  isCompleted: boolean;
  source: 'canvas' | 'manual';
  courseCode?: string;
  priority?: number;
}

export interface WeeklyGroup {
  weekStart: Date;
  weekEnd: Date;
  assignments: WeeklyAssignment[];
  totalCount: number;
  completedCount: number;
  progressPercentage: number;
  isCurrentWeek: boolean;
}

export interface WeeklyProgressData {
  currentWeek: WeeklyGroup;
  previousWeeks: WeeklyGroup[];
  upcomingWeeks: WeeklyGroup[];
}