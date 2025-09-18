import React from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, Calendar, BookOpen } from 'lucide-react';
import type { WeeklyGroup } from '@/types/weeklyProgress';

interface WeeklyProgressCardProps {
  weekGroup: WeeklyGroup;
  showAssignments?: boolean;
  onWeekClick?: (weekStart: Date, weekEnd: Date) => void;
}

export const WeeklyProgressCard: React.FC<WeeklyProgressCardProps> = ({ 
  weekGroup, 
  showAssignments = false,
  onWeekClick
}) => {
  const weekLabel = weekGroup.isCurrentWeek 
    ? 'This Week' 
    : `${format(weekGroup.weekStart, 'MMM d')} - ${format(weekGroup.weekEnd, 'MMM d')}`;

  const handleWeekClick = () => {
    if (onWeekClick) {
      onWeekClick(weekGroup.weekStart, weekGroup.weekEnd);
    }
  };

  return (
    <Card 
      className={`${weekGroup.isCurrentWeek ? 'border-primary bg-primary/5' : ''} ${onWeekClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={handleWeekClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5" />
            {weekLabel}
            {weekGroup.isCurrentWeek && (
              <Badge variant="default" className="ml-2">Current</Badge>
            )}
          </CardTitle>
          <div className="text-right">
            <div className="text-2xl font-bold">
              {weekGroup.progressPercentage}%
            </div>
            <div className="text-sm text-muted-foreground">
              {weekGroup.completedCount} of {weekGroup.totalCount}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <Progress value={weekGroup.progressPercentage} className="h-3" />
        
        {showAssignments && weekGroup.assignments.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Assignments ({weekGroup.assignments.length})
            </h4>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {weekGroup.assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between p-2 rounded-lg border bg-background/50"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {assignment.isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm truncate ${assignment.isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                        {assignment.title}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{format(assignment.dueDate, 'MMM d, h:mm a')}</span>
                        {assignment.courseCode && (
                          <Badge variant="outline" className="text-xs">
                            {assignment.courseCode}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {assignment.source}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};