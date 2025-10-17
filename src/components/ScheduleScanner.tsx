import { useState } from "react";
import { Upload, FileText, Calendar, Loader2, Clock, MapPin, User, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { fileToDataURL } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { fromUserTimezone } from "@/lib/timezone-utils";

interface ScheduleEvent {
  course: string;
  day: string;
  startTime: string;
  endTime: string;
  location?: string;
  instructor?: string;
  type?: string;
}

interface ScheduleAnalysis {
  format: string;
  events: ScheduleEvent[];
  rawText: string;
  confidence: number;
}

export const ScheduleScanner = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scheduleAnalysis, setScheduleAnalysis] = useState<ScheduleAnalysis | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<Set<number>>(new Set());
  const [isAddingToCalendar, setIsAddingToCalendar] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    
    if (imageFile) {
      handleFileUpload(imageFile);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file (PNG, JPG, etc.)",
        variant: "destructive",
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleFileUpload = async (file: File) => {
    setSelectedFile(file);
    setIsProcessing(true);
    setScheduleAnalysis(null);
    
    try {
      // Convert file to data URL
      const imageData = await fileToDataURL(file);
          
      console.log('Calling schedule scanner function...');
      const { data, error } = await supabase.functions.invoke('ai-schedule-scanner', {
        body: { imageData }
      });

      if (error) {
        console.error('Schedule scanner error:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to process the schedule image. Please try again.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      if (data.error) {
        toast({
          title: "Processing Error",
          description: data.error,
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      setScheduleAnalysis(data);
      setSelectedEvents(new Set()); // Reset selected events
      toast({
        title: "Schedule analyzed successfully",
        description: `Detected ${data.format} with ${data.events.length} events (${Math.round(data.confidence * 100)}% confidence)`,
      });
      
    } catch (error) {
      console.error('Error uploading file:', error);
      setIsProcessing(false);
      toast({
        title: "Error",
        description: "Failed to upload the file. Please try again.",
        variant: "destructive",
      });
    }
  };

  const toggleEventSelection = (index: number) => {
    const newSelected = new Set(selectedEvents);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedEvents(newSelected);
  };

  const selectAllEvents = () => {
    if (scheduleAnalysis) {
      setSelectedEvents(new Set(Array.from({ length: scheduleAnalysis.events.length }, (_, i) => i)));
    }
  };

  const deselectAllEvents = () => {
    setSelectedEvents(new Set());
  };

  // Convert time string like "8:00 AM" to Date object
  const parseTimeToDate = (dateStr: string, timeStr: string): Date => {
    const date = new Date(dateStr); // YYYY-MM-DD
    
    // Parse time (H:MM AM/PM)
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s?(AM|PM)/i);
    if (!timeMatch) {
      throw new Error(`Invalid time format: ${timeStr}`);
    }
    
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const period = timeMatch[3].toUpperCase();
    
    // Convert to 24-hour format
    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }
    
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  const addSelectedToCalendar = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to add events to your calendar.",
        variant: "destructive",
      });
      return;
    }

    if (selectedEvents.size === 0) {
      toast({
        title: "No events selected",
        description: "Please select at least one event to add to your calendar.",
        variant: "destructive",
      });
      return;
    }

    setIsAddingToCalendar(true);

    try {
      // Get user's timezone from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('timezone')
        .eq('user_id', user.id)
        .single();
      
      const userTimezone = profile?.timezone || 'America/New_York';

      // Convert selected events to database format
      const eventsToAdd = Array.from(selectedEvents).map(index => {
        const event = scheduleAnalysis!.events[index];
        
        // Parse times to Date objects
        const startDate = parseTimeToDate(event.day, event.startTime);
        const endDate = parseTimeToDate(event.day, event.endTime);
        
        // Convert to UTC using user's timezone
        const startTimeUTC = fromUserTimezone(startDate, userTimezone);
        const endTimeUTC = fromUserTimezone(endDate, userTimezone);
        
        return {
          user_id: user.id,
          title: event.course,
          description: event.type ? `${event.type} session` : 'Scheduled class',
          start_time: startTimeUTC.toISOString(),
          end_time: endTimeUTC.toISOString(),
          location: event.location || null,
          source_provider: 'schedule_scanner',
          event_type: event.type || 'class',
          is_all_day: false,
          // Add weekly recurrence for classes (15 weeks = typical semester)
          recurrence_rule: 'FREQ=WEEKLY;COUNT=15'
        };
      });

      console.log('Adding events to calendar:', eventsToAdd);

      const { error } = await supabase
        .from('events')
        .insert(eventsToAdd);

      if (error) {
        console.error('Error adding events:', error);
        toast({
          title: "Error adding events",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Events added successfully!",
        description: `${selectedEvents.size} classes have been added to your calendar with weekly recurrence.`,
      });
      
      // Reset state
      setSelectedEvents(new Set());
      setScheduleAnalysis(null);
      setSelectedFile(null);
      
    } catch (error) {
      console.error('Error processing events:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add events to calendar",
        variant: "destructive",
      });
    } finally {
      setIsAddingToCalendar(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Schedule Scanner</h1>
        <p className="text-muted-foreground">
          Upload an image of your class schedule or timetable to automatically extract and organize your schedule
        </p>
      </div>

      {/* Upload Area */}
      <Card className="relative overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upload Schedule Image
          </CardTitle>
          <CardDescription>
            Drag and drop an image of your schedule or click to browse
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
              isDragging
                ? 'border-primary bg-primary/5 scale-[1.02]'
                : 'border-border hover:border-primary/50 hover:bg-muted/30'
            } ${isProcessing ? 'pointer-events-none opacity-60' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isProcessing ? (
              <div className="space-y-4">
                <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                <div className="space-y-2">
                  <p className="text-lg font-medium text-foreground">Processing Schedule...</p>
                  <p className="text-sm text-muted-foreground">
                    Extracting schedule information from your image
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-medium text-foreground">
                    {selectedFile ? selectedFile.name : 'Drop your schedule image here'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Supports PNG, JPG, and other image formats
                  </p>
                </div>
                <Button variant="outline" asChild className="mt-4">
                  <label htmlFor="schedule-upload" className="cursor-pointer">
                    Browse Files
                    <input
                      id="schedule-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview Image */}
      {selectedFile && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Uploaded Image
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <img
                src={URL.createObjectURL(selectedFile)}
                alt="Uploaded schedule"
                className="max-w-full h-auto rounded-lg border border-border"
                style={{ maxHeight: '400px' }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schedule Analysis Results */}
      {scheduleAnalysis && (
        <div className="space-y-4">
          {/* Format Detection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Schedule Analysis
              </CardTitle>
              <CardDescription>
                Detected format and confidence level
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-medium">Format: {scheduleAnalysis.format}</p>
                  <p className="text-sm text-muted-foreground">
                    {scheduleAnalysis.events.length} events detected
                  </p>
                </div>
                <Badge variant={scheduleAnalysis.confidence > 0.8 ? "default" : scheduleAnalysis.confidence > 0.5 ? "secondary" : "destructive"}>
                  {Math.round(scheduleAnalysis.confidence * 100)}% confidence
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Extracted Events */}
          {scheduleAnalysis.events.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Schedule Events Found ({scheduleAnalysis.events.length})
                </CardTitle>
                <CardDescription>
                  Select events to add to your calendar
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllEvents}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={deselectAllEvents}
                  >
                    Deselect All
                  </Button>
                  <div className="flex-1" />
                  <Button
                    onClick={addSelectedToCalendar}
                    disabled={selectedEvents.size === 0 || isAddingToCalendar}
                    className="ml-auto"
                  >
                    {isAddingToCalendar ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      `Add Selected to Calendar (${selectedEvents.size})`
                    )}
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {scheduleAnalysis.events.map((event, index) => (
                    <div 
                      key={index} 
                      className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 ${
                        selectedEvents.has(index) 
                          ? 'border-primary bg-primary/5 shadow-sm' 
                          : 'border-border hover:border-primary/50 hover:bg-muted/30'
                      }`}
                      onClick={() => toggleEventSelection(index)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                            selectedEvents.has(index) 
                              ? 'border-primary bg-primary' 
                              : 'border-muted-foreground'
                          }`}>
                            {selectedEvents.has(index) && (
                              <div className="w-2 h-2 bg-white rounded-sm" />
                            )}
                          </div>
                          <h4 className="font-medium text-foreground">{event.course}</h4>
                        </div>
                        {event.type && (
                          <Badge variant="outline">{event.type}</Badge>
                        )}
                      </div>
                      <div className="ml-7 mt-2 grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>{event.day}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          <span>{event.startTime} - {event.endTime}</span>
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span>{event.location}</span>
                          </div>
                        )}
                        {event.instructor && (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <span>{event.instructor}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Tips for Better Schedule Recognition</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Ensure the image is clear and well-lit</li>
            <li>• Make sure all text is visible and not cut off</li>
            <li>• Higher resolution images work better</li>
            <li>• Avoid shadows or glare on the schedule</li>
            <li>• Screenshots of digital schedules work best</li>
            <li>• Supports various formats: grid tables, lists, university portals</li>
            <li>• Include course codes, times, days, and locations for best results</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};