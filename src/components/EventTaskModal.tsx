import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, BookOpen, AlertCircle, Edit3, Save, X } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Event {
  id: string;
  title: string;
  start_time: string;
  end_time?: string;
  event_type: string;
  source_provider?: string;
}

interface Task {
  id: string;
  title: string;
  due_date?: string;
  priority_score?: number;
  completion_status?: string;
  course_name?: string;
}

interface EventTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  event?: Event;
  task?: Task;
  selectedDate?: Date;
  selectedHour?: number;
}

export const EventTaskModal = ({
  isOpen,
  onClose,
  event,
  task,
  selectedDate,
  selectedHour
}: EventTaskModalProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(event?.title || task?.title || "");
  const [editedNotes, setEditedNotes] = useState("");
  const [editedPriority, setEditedPriority] = useState(task?.priority_score?.toString() || "5");
  const [editedStatus, setEditedStatus] = useState(task?.completion_status || "pending");
  const { toast } = useToast();

  const handleSave = () => {
    // Here you would typically save to your backend
    toast({
      title: "Changes saved",
      description: `Successfully updated ${event ? "event" : "task"}: ${editedTitle}`,
    });
    setIsEditing(false);
  };

  const handleDelete = () => {
    // Here you would typically delete from your backend
    toast({
      title: "Deleted",
      description: `Successfully deleted ${event ? "event" : "task"}: ${event?.title || task?.title}`,
    });
    onClose();
  };

  const getModalTitle = () => {
    if (event) return isEditing ? "Edit Event" : "Event Details";
    if (task) return isEditing ? "Edit Task" : "Task Details";
    return "Create New Item";
  };

  const formatDateTime = (dateString: string, sourceProvider?: string) => {
    const date = new Date(dateString);
    
    // Handle Canvas provider special case (same logic as WeeklyCalendarView)
    let displayTime;
    if (sourceProvider === 'canvas' && dateString.includes('23:59:59+00')) {
      const fixedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
      displayTime = fixedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } else {
      displayTime = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    
    return {
      date: format(date, "EEEE, MMMM d, yyyy"),
      time: displayTime
    };
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {event && <Calendar className="h-5 w-5 text-primary" />}
            {task && <AlertCircle className="h-5 w-5 text-warning" />}
            {getModalTitle()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Title Section */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium">
              {event ? "Event" : "Task"} Title
            </Label>
            {isEditing ? (
              <Input
                id="title"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="text-lg font-medium"
              />
            ) : (
              <h2 className="text-xl font-semibold text-foreground">
                {event?.title || task?.title}
              </h2>
            )}
          </div>

          {/* Event Details */}
          {event && (
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Event Information</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Date & Time</Label>
                  <div className="text-sm">
                    {event.start_time && (
                      <>
                        <div>{formatDateTime(event.start_time, event.source_provider).date}</div>
                        <div className="text-muted-foreground">{formatDateTime(event.start_time, event.source_provider).time}</div>
                      </>
                    )}
                  </div>
                </div>
                
                <div>
                  <Label className="text-xs text-muted-foreground">Type</Label>
                  <Badge variant="secondary" className="mt-1">
                    {event.event_type}
                  </Badge>
                </div>
              </div>

              {event.source_provider && (
                <div>
                  <Label className="text-xs text-muted-foreground">Source</Label>
                  <div className="text-sm flex items-center gap-1 mt-1">
                    <BookOpen className="h-3 w-3" />
                    {event.source_provider}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Task Details */}
          {task && (
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Task Information</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Due Date</Label>
                  <div className="text-sm">
                    {task.due_date && (
                      <>
                        <div>{formatDateTime(task.due_date).date}</div>
                        <div className="text-muted-foreground">{formatDateTime(task.due_date).time}</div>
                      </>
                    )}
                  </div>
                </div>
                
                <div>
                  <Label className="text-xs text-muted-foreground">Priority</Label>
                  {isEditing ? (
                    <Select value={editedPriority} onValueChange={setEditedPriority}>
                      <SelectTrigger className="w-full mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">High (10)</SelectItem>
                        <SelectItem value="7">Medium (7)</SelectItem>
                        <SelectItem value="5">Normal (5)</SelectItem>
                        <SelectItem value="3">Low (3)</SelectItem>
                        <SelectItem value="1">Very Low (1)</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge 
                      variant={
                        (task.priority_score || 0) >= 8 ? "destructive" : 
                        (task.priority_score || 0) >= 6 ? "default" : 
                        "secondary"
                      }
                      className="mt-1"
                    >
                      {task.priority_score || "Not set"}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  {isEditing ? (
                    <Select value={editedStatus} onValueChange={setEditedStatus}>
                      <SelectTrigger className="w-full mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge 
                      variant={
                        task.completion_status === "completed" ? "default" :
                        task.completion_status === "in_progress" ? "secondary" :
                        "outline"
                      }
                      className="mt-1"
                    >
                      {task.completion_status || "Pending"}
                    </Badge>
                  )}
                </div>

                {task.course_name && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Course</Label>
                    <div className="text-sm flex items-center gap-1 mt-1">
                      <BookOpen className="h-3 w-3" />
                      {task.course_name}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes Section */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
            {isEditing ? (
              <Textarea
                id="notes"
                value={editedNotes}
                onChange={(e) => setEditedNotes(e.target.value)}
                placeholder="Add notes or description..."
                rows={4}
              />
            ) : (
              <div className="p-3 bg-muted/30 rounded-md min-h-[100px]">
                <p className="text-sm text-muted-foreground">
                  {editedNotes || "No notes added yet. Click edit to add notes."}
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between pt-4 border-t">
            <div>
              {!isEditing && (
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  size="sm"
                >
                  Delete
                </Button>
              )}
            </div>
            
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                    size="sm"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    size="sm"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Save Changes
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => setIsEditing(true)}
                  size="sm"
                >
                  <Edit3 className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};