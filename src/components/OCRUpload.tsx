import { useState, useCallback } from "react";
import { Upload, Camera, FileImage, Check, X, Calendar, Clock, MapPin, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { imageFileToBase64Compressed } from "@/lib/utils";
import { ocrExtractText } from "@/lib/ocr";
import { fromZonedTime } from "date-fns-tz";


interface ParsedEvent {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  recurrence?: string;
  confidence: number;
}

interface ParsedTask {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  dueTime: string;
  courseName?: string;
  priority: number;
  taskType?: string;
  confidence: number;
}

const mockParsedEvents: ParsedEvent[] = [
  {
    id: '1',
    title: 'Data Structures Lecture',
    date: '2024-09-09',
    startTime: '09:00',
    endTime: '10:20',
    location: 'Engineering 203',
    recurrence: 'MWF',
    confidence: 95,
  },
  {
    id: '2',
    title: 'Office Hours - Prof. Smith',
    date: '2024-09-10',
    startTime: '14:00',
    endTime: '16:00',
    location: 'CS Building Room 301',
    confidence: 88,
  },
  {
    id: '3',
    title: 'Midterm Exam',
    date: '2024-10-15',
    startTime: '18:00',
    endTime: '20:00',
    location: 'Main Hall 101',
    confidence: 98,
  },
];

export const OCRUpload = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedEvents, setParsedEvents] = useState<ParsedEvent[]>([]);
  const [parsedTasks, setParsedTasks] = useState<ParsedTask[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file (PNG, JPG, etc.)",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    setIsProcessing(true);

    try {
      // Preserve PNG uploads without recompression; compress others for speed
      let base64: string;
      let mimeType: string;
      if (file.type === 'image/png') {
        base64 = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => {
            const s = String(fr.result || '');
            resolve(s.split(',')[1] || '');
          };
          fr.onerror = reject;
          fr.readAsDataURL(file);
        });
        mimeType = 'image/png';
      } else {
        const res = await imageFileToBase64Compressed(file, 1200, 'image/jpeg', 0.75);
        base64 = res.base64;
        mimeType = res.mimeType;
      }

      try {
        // Call our AI OCR edge function
        const { data: response, error } = await supabase.functions.invoke('ai-image-ocr', {
          body: { imageBase64: base64, mimeType, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, currentDate: new Date().toISOString() }
        });

        if (error) {
          console.error('OCR Error:', error);
          throw new Error('Failed to process image');
        }

          if (response.success && (
            (Array.isArray(response.events) && response.events.length > 0) || 
            (Array.isArray(response.tasks) && response.tasks.length > 0)
          )) {
            setParsedEvents(response.events || []);
            setParsedTasks(response.tasks || []);
            const totalItems = (response.events?.length || 0) + (response.tasks?.length || 0);
            toast({
              title: "Schedule parsed successfully!",
              description: `Found ${response.events?.length || 0} events and ${response.tasks?.length || 0} tasks in your image.`,
            });
          } else {
            // Fallback: client-side OCR to text then AI structuring
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const text = await ocrExtractText(file);
            const { data: textResponse, error: textError } = await supabase.functions.invoke('ai-image-ocr', {
              body: { text, imageBase64: base64, mimeType, timeZone: tz, currentDate: new Date().toISOString() }
            });

            if (textError) {
              throw new Error('Fallback processing failed');
            }

            if (textResponse.success && (
              (Array.isArray(textResponse.events) && textResponse.events.length > 0) ||
              (Array.isArray(textResponse.tasks) && textResponse.tasks.length > 0)
            )) {
              setParsedEvents(textResponse.events || []);
              setParsedTasks(textResponse.tasks || []);
              const totalItems = (textResponse.events?.length || 0) + (textResponse.tasks?.length || 0);
              toast({ 
                title: 'Schedule parsed (OCR fallback)', 
                description: `Found ${textResponse.events?.length || 0} events and ${textResponse.tasks?.length || 0} tasks.`, 
              });
            } else {
              const msg = textResponse.error || 'No events or tasks found in image/text';
              toast({ title: 'No items found', description: msg, variant: 'destructive' });
              return;
            }
          }
      } catch (error) {
        console.error('Error processing image:', error);
        toast({
          title: "Processing failed",
          description: "Failed to extract schedule from image. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsProcessing(false);
      }

    } catch (error) {
      console.error('File upload error:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  }, [toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  const addToCalendar = async (event: ParsedEvent) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to add events",
        variant: "destructive",
      });
      return;
    }

    try {
      // Parse parts and build timezone-aware datetimes
      const datePart = String(event.date || '').slice(0, 10); // YYYY-MM-DD
      const startTimePart = String(event.startTime || '00:00').slice(0, 5); // HH:MM
      const endTimePart = String(event.endTime || '00:00').slice(0, 5); // HH:MM
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const start = fromZonedTime(new Date(`${datePart}T${startTimePart}:00`), tz);
      const end = fromZonedTime(new Date(`${datePart}T${endTimePart}:00`), tz);

      const startTimeISO = start.toISOString();
      const endTimeISO = end.toISOString();

      // Add to events table
      const { error } = await supabase
        .from('events')
        .insert({
          user_id: user.id,
          title: event.title,
          start_time: startTimeISO,
          end_time: endTimeISO,
          location: event.location,
          description: `Extracted from image with ${event.confidence}% confidence`,
          event_type: 'class',
          source_provider: 'ocr_upload',
          recurrence_rule: event.recurrence || null
        });

      if (error) {
        console.error('Error adding event:', error);
        toast({
          title: "Error",
          description: "Failed to add event to calendar",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Event added!",
        description: `${event.title} has been added to your calendar.`,
      });
      setParsedEvents(prev => prev.filter(e => e.id !== event.id));
    } catch (error) {
      console.error('Error adding to calendar:', error);
      toast({
        title: "Error",
        description: "Failed to add event to calendar",
        variant: "destructive",
      });
    }
  };

  const addTaskToTasks = async (task: ParsedTask) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to add tasks",
        variant: "destructive",
      });
      return;
    }

    try {
      const datePart = String(task.dueDate || '').slice(0, 10); // YYYY-MM-DD
      const timePart = String(task.dueTime || '23:59').slice(0, 5); // HH:MM
      // Build timezone-aware due datetime
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const start = fromZonedTime(new Date(`${datePart}T${timePart}:00`), tz);
      const dueDateTime = start.toISOString();

      // Add to tasks table
      const { error } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          title: task.title,
          description: task.description || `Extracted from image with ${task.confidence}% confidence`,
          course_name: task.courseName || null,
          due_date: dueDateTime,
          priority_score: task.priority || 2,
          completion_status: 'pending',
          source_provider: 'ocr_upload'
        });

      if (error) {
        console.error('Error adding task:', error);
        toast({
          title: "Error",
          description: "Failed to add task",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Task added!",
        description: `${task.title} has been added to your tasks.`,
      });
      setParsedTasks(prev => prev.filter(t => t.id !== task.id));
    } catch (error) {
      console.error('Error adding task:', error);
      toast({
        title: "Error",
        description: "Failed to add task",
        variant: "destructive",
      });
    }
  };

  const rejectEvent = (event: ParsedEvent) => {
    setParsedEvents(prev => prev.filter(e => e.id !== event.id));
  };

  const rejectTask = (task: ParsedTask) => {
    setParsedTasks(prev => prev.filter(t => t.id !== task.id));
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground mb-2">Image Upload</h1>
        <p className="text-muted-foreground">
          Upload photos of schedules, syllabi, or flyers to automatically extract events
        </p>
      </div>

      {/* Upload Area */}
      <Card className="border-2 border-dashed border-border">
        <CardContent className="p-8">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-upload')?.click()}
            className={`text-center transition-all duration-200 cursor-pointer ${
              isDragging ? 'scale-105 bg-primary/5' : ''
            }`}
          >
            {isProcessing ? (
              <div className="space-y-4">
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <Camera className="h-8 w-8 text-primary animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-foreground">Processing your image...</h3>
                  <p className="text-muted-foreground">Using AI to extract schedule information</p>
                </div>
                <div className="w-full max-w-xs mx-auto bg-muted rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full animate-pulse" style={{ width: '70%' }}></div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-foreground">Upload a schedule image</h3>
                  <p className="text-muted-foreground">
                    Drag and drop an image here, or click to browse
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <Badge variant="outline" className="bg-muted/50">
                    <FileImage className="h-3 w-3 mr-1" />
                    Class Schedules
                  </Badge>
                  <Badge variant="outline" className="bg-muted/50">
                    <Calendar className="h-3 w-3 mr-1" />
                    Syllabi
                  </Badge>
                  <Badge variant="outline" className="bg-muted/50">
                    <Clock className="h-3 w-3 mr-1" />
                    Event Flyers
                  </Badge>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Uploaded Image Display */}
      {selectedFile && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileImage className="h-5 w-5 text-primary" />
              Uploaded Image
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center group">
              <img
                src={URL.createObjectURL(selectedFile)}
                alt="Uploaded schedule"
                className="max-w-full max-h-96 rounded-lg border shadow-md group-hover:animate-[scroll-boomerang_6s_ease-in-out_infinite]"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parsed Events and Tasks */}
      {(parsedEvents.length > 0 || parsedTasks.length > 0) && (
        <div className="space-y-6">
          {/* Events Section */}
          {parsedEvents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Extracted Events
                  <Badge className="bg-success/10 text-success">
                    {parsedEvents.length} found
                  </Badge>
                </CardTitle>
              </CardHeader>
          <CardContent className="space-y-4">
            {parsedEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:shadow-md transition-all"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-foreground">{event.title}</h3>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        event.confidence >= 95 ? 'bg-success/10 text-success border-success/20' :
                        event.confidence >= 85 ? 'bg-warning/10 text-warning border-warning/20' :
                        'bg-muted text-muted-foreground'
                      }`}
                    >
                      {event.confidence}% confidence
                    </Badge>
                  </div>
                  
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(event.date).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {event.startTime} - {event.endTime}
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {event.location}
                    </div>
                    {event.recurrence && (
                      <Badge variant="secondary" className="text-xs">
                        {event.recurrence}
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => addToCalendar(event)}
                    className="bg-success hover:bg-success/90 text-success-foreground"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => rejectEvent(event)}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                </div>
              </div>
            ))}
            </CardContent>
          </Card>
        )}

        {/* Tasks Section */}
        {parsedTasks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Extracted Tasks
                <Badge className="bg-warning/10 text-warning">
                  {parsedTasks.length} found
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {parsedTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:shadow-md transition-all"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-foreground">{task.title}</h3>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          task.confidence >= 95 ? 'bg-success/10 text-success border-success/20' :
                          task.confidence >= 85 ? 'bg-warning/10 text-warning border-warning/20' :
                          'bg-muted text-muted-foreground'
                        }`}
                      >
                        {task.confidence}% confidence
                      </Badge>
                      <Badge 
                        variant="secondary" 
                        className={`text-xs ${
                          task.priority === 4 ? 'bg-red-100 text-red-800' :
                          task.priority === 3 ? 'bg-orange-100 text-orange-800' :
                          task.priority === 2 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}
                      >
                        Priority {task.priority}
                      </Badge>
                    </div>
                    
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Due: {new Date(task.dueDate).toLocaleDateString()} at {task.dueTime}
                      </div>
                      {task.courseName && (
                        <div className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          {task.courseName}
                        </div>
                      )}
                      {task.taskType && (
                        <Badge variant="secondary" className="text-xs">
                          {task.taskType}
                        </Badge>
                      )}
                    </div>
                    {task.description && (
                      <p className="text-sm text-muted-foreground">{task.description}</p>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => addTaskToTasks(task)}
                      className="bg-warning hover:bg-warning/90 text-warning-foreground"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Add Task
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rejectTask(task)}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        </div>
      )}

      {/* Tips */}
      <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
        <CardContent className="p-6">
          <h3 className="font-medium text-foreground mb-3">Tips for better OCR results:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-muted-foreground">
            <div>• Ensure good lighting and clear text</div>
            <div>• Avoid shadows or glare on the image</div>
            <div>• Keep the camera steady when taking photos</div>
            <div>• Include the full schedule in the frame</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};