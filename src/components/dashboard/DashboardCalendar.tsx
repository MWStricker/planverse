import { memo, useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { WeeklyCalendarView } from "@/components/WeeklyCalendarView";
import { DailyCalendarView } from "@/components/DailyCalendarView";
import { MonthlyCalendarView } from "@/components/MonthlyCalendarView";
import { CanvasIntegration } from "@/components/CanvasIntegration";
import { Trash2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface Event {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  event_type: string;
  source_provider?: string;
  description?: string;
  is_completed?: boolean;
}

interface Task {
  id: string;
  title: string;
  due_date: string;
  priority_score: number;
  completion_status: string;
  course_name: string;
  source_provider?: string;
}

interface DashboardCalendarProps {
  events: Event[];
  tasks: Task[];
  storedColors: Record<string, string>;
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  onClearAllData: () => Promise<void>;
}

export const DashboardCalendar = memo(({ 
  events, 
  tasks, 
  storedColors, 
  currentDate, 
  setCurrentDate,
  onClearAllData 
}: DashboardCalendarProps) => {
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('week');

  return (
    <div className="space-y-6">
      {/* View Controls */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'day' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('day')}
          >
            Day
          </Button>
          <Button
            variant={viewMode === 'week' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('week')}
          >
            Week
          </Button>
          <Button
            variant={viewMode === 'month' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('month')}
          >
            Month
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-2">
                <Trash2 className="h-4 w-4" />
                Clear All Data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Clear Calendar Data
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>All events (Canvas and manually added)</li>
                    <li>All tasks and assignments</li>
                  </ul>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Your preferences, color settings, and other configurations will be preserved.
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={onClearAllData}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Clear Calendar Data
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Calendar Navigation - Date Display */}
      <div className="flex items-center justify-center">
        <h2 className="text-xl font-semibold">
          {format(currentDate, viewMode === 'month' ? 'MMMM yyyy' : 'MMM d, yyyy')}
        </h2>
      </div>

      {/* Calendar Component */}
      <div className="border rounded-lg">
        {viewMode === 'day' && (
          <DailyCalendarView
            events={events}
            tasks={tasks}
            storedColors={storedColors}
            currentDay={currentDate}
            setCurrentDay={setCurrentDate}
          />
        )}
        {viewMode === 'week' && (
          <WeeklyCalendarView
            events={events}
            tasks={tasks}
            currentWeek={currentDate}
            setCurrentWeek={setCurrentDate}
          />
        )}
        {viewMode === 'month' && (
          <MonthlyCalendarView
            events={events}
            tasks={tasks}
            currentMonth={currentDate}
            setCurrentMonth={setCurrentDate}
          />
        )}
      </div>

      {/* Canvas Integration */}
      <div className="mt-6">
        <CanvasIntegration />
      </div>
    </div>
  );
});

DashboardCalendar.displayName = 'DashboardCalendar';
