import { memo } from 'react';
import { format, isBefore, addHours } from 'date-fns';
import { Clock, CheckCircle2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Event {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  event_type: string;
  is_completed?: boolean;
  description?: string;
}

interface TimelineViewProps {
  events: Event[];
  onEventClick: (event: Event) => void;
  onToggle: (id: string, checked: boolean) => void;
}

export const TimelineView = memo(({ events, onEventClick, onToggle }: TimelineViewProps) => {
  const sortedEvents = [...events].sort((a, b) => 
    new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  const getTimeBlock = (dateStr: string) => {
    const date = new Date(dateStr);
    const hour = date.getHours();
    if (hour < 12) return 'Morning';
    if (hour < 17) return 'Afternoon';
    return 'Evening';
  };

  const isUpcomingSoon = (dateStr: string) => {
    const eventTime = new Date(dateStr);
    const now = new Date();
    const oneHourFromNow = addHours(now, 1);
    return isBefore(now, eventTime) && isBefore(eventTime, oneHourFromNow);
  };

  const groupedEvents = sortedEvents.reduce((acc, event) => {
    const block = getTimeBlock(event.start_time);
    if (!acc[block]) acc[block] = [];
    acc[block].push(event);
    return acc;
  }, {} as Record<string, Event[]>);

  const timeBlocks = ['Morning', 'Afternoon', 'Evening'];

  return (
    <div className="space-y-6">
      {timeBlocks.map((block) => {
        const blockEvents = groupedEvents[block];
        if (!blockEvents || blockEvents.length === 0) return null;

        return (
          <div key={block} className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {block}
            </h4>
            <div className="relative pl-6 space-y-3">
              {/* Vertical line */}
              <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-border" />
              
              {blockEvents.map((event, index) => {
                const upcoming = isUpcomingSoon(event.start_time);
                return (
                  <div
                    key={event.id}
                    className={cn(
                      "relative animate-fade-in",
                      upcoming && "animate-pulse-glow"
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {/* Timeline dot */}
                    <div className={cn(
                      "absolute -left-[19px] top-2 w-3 h-3 rounded-full border-2 bg-background",
                      event.is_completed ? "border-green-500" : "border-primary",
                      upcoming && "border-primary shadow-[0_0_8px_rgba(var(--primary),0.6)]"
                    )} />
                    
                    <div
                      onClick={() => onEventClick(event)}
                      className={cn(
                        "p-3 rounded-lg border bg-card cursor-pointer transition-all hover:shadow-md",
                        upcoming && "ring-2 ring-primary/20"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1">
                          <Checkbox
                            checked={event.is_completed || false}
                            onCheckedChange={(checked) => {
                              onToggle(event.id, checked as boolean);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "font-medium text-sm",
                              event.is_completed && "line-through text-muted-foreground"
                            )}>
                              {event.title}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(event.start_time), 'h:mm a')} - {format(new Date(event.end_time), 'h:mm a')}
                              </span>
                              {upcoming && (
                                <Badge variant="outline" className="text-xs">
                                  Starting Soon
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        {event.is_completed && (
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
});

TimelineView.displayName = 'TimelineView';
