import { useState } from "react";
import { Upload, FileText, Calendar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

export const ScheduleScanner = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedSchedule, setExtractedSchedule] = useState("");
  const { toast } = useToast();

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
    
    try {
      // TODO: Implement schedule scanning logic
      // This would connect to an AI service to extract schedule information
      // For now, we'll show a placeholder
      
      setTimeout(() => {
        setExtractedSchedule("Schedule scanning functionality will be implemented here. This will extract class schedules, meeting times, and important dates from uploaded images.");
        setIsProcessing(false);
        toast({
          title: "Schedule scanned successfully",
          description: "Your schedule has been processed and extracted.",
        });
      }, 2000);
      
    } catch (error) {
      console.error('Error processing schedule:', error);
      setIsProcessing(false);
      toast({
        title: "Error",
        description: "Failed to process the schedule image. Please try again.",
        variant: "destructive",
      });
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

      {/* Extracted Schedule */}
      {extractedSchedule && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Extracted Schedule
            </CardTitle>
            <CardDescription>
              Review and edit the extracted schedule information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={extractedSchedule}
              onChange={(e) => setExtractedSchedule(e.target.value)}
              placeholder="Extracted schedule will appear here..."
              className="min-h-[200px] resize-y"
            />
            <div className="mt-4 flex gap-2">
              <Button>
                Add to Calendar
              </Button>
              <Button variant="outline">
                Export Schedule
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Tips for Better Results</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Ensure the image is clear and well-lit</li>
            <li>• Make sure all text is visible and not cut off</li>
            <li>• Higher resolution images work better</li>
            <li>• Avoid shadows or glare on the schedule</li>
            <li>• Screenshots or photos of digital schedules work well</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};