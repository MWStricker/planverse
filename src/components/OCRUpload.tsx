import { useState, useCallback } from "react";
import { Upload, Camera, FileImage, Check, X, Calendar, Clock, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

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

    // Simulate OCR processing
    setTimeout(() => {
      setParsedEvents(mockParsedEvents);
      setIsProcessing(false);
      toast({
        title: "Schedule parsed successfully!",
        description: `Found ${mockParsedEvents.length} events in your image.`,
      });
    }, 2000);
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

  const addToCalendar = (event: ParsedEvent) => {
    toast({
      title: "Event added!",
      description: `${event.title} has been added to your calendar.`,
    });
    setParsedEvents(prev => prev.filter(e => e.id !== event.id));
  };

  const rejectEvent = (event: ParsedEvent) => {
    setParsedEvents(prev => prev.filter(e => e.id !== event.id));
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

      {/* Parsed Events */}
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