import { useState, useCallback } from "react";
import { Upload, Camera, FileImage, Copy, Sparkles, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { imageFileToBase64Compressed } from "@/lib/utils";
import { ocrExtractText } from "@/lib/ocr";
import { Textarea } from "@/components/ui/textarea";


export const OCRUpload = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState<string>("");
  const [paraphrasedText, setParaphrasedText] = useState<string>("");
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
    setExtractedText("");
    setParaphrasedText("");

    try {
      // Use OCR to extract both raw and paraphrased text
      const result = await ocrExtractText(file);
      setExtractedText(result.rawText);
      setParaphrasedText(result.paraphrasedText);
      
      toast({
        title: "Text extracted successfully!",
        description: "Your notes have been processed and paraphrased automatically.",
      });
    } catch (error) {
      console.error('Error processing image:', error);
      toast({
        title: "Processing failed",
        description: "Failed to extract text from image. Please try again.",
        variant: "destructive",
      });
    } finally {
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


  const copyToClipboard = async (text: string, type: 'raw' | 'paraphrased') => {
    if (!text.trim()) {
      toast({
        title: "No text to copy",
        description: `No ${type} text available.`,
        variant: "destructive",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied to clipboard!",
        description: `${type === 'raw' ? 'Raw text' : 'Paraphrased notes'} copied successfully.`,
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Failed to copy text to clipboard.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground mb-2">Note Digitizer</h1>
        <p className="text-muted-foreground">
          Upload photos of handwritten or printed notes to extract and paraphrase text
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
                  <p className="text-muted-foreground">Extracting text from your notes</p>
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
                  <h3 className="text-lg font-medium text-foreground">Upload your notes</h3>
                  <p className="text-muted-foreground">
                    Drag and drop an image here, or click to browse
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                  autoComplete="off"
                  data-form-type="other"
                  name="file-upload"
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
            <div className="flex justify-center">
              <img
                src={URL.createObjectURL(selectedFile)}
                alt="Uploaded notes"
                className="max-w-full max-h-96 rounded-lg border shadow-md hover:shadow-lg transition-shadow duration-200"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Text Processing Section */}
      {extractedText && (
        <div className="space-y-6">
          {/* Action Buttons */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Copy Options
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Button
                  onClick={() => copyToClipboard(extractedText, 'raw')}
                  variant="outline"
                  className="flex-1"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Raw Text
                </Button>
                <Button
                  onClick={() => copyToClipboard(paraphrasedText, 'paraphrased')}
                  variant="default"
                  className="flex-1"
                  disabled={!paraphrasedText.trim()}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Paraphrased Text
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Raw Text Display */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Extracted Text
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={extractedText}
                readOnly
                className="min-h-[200px] resize-none"
                placeholder="Extracted text will appear here..."
              />
            </CardContent>
          </Card>

          {/* Paraphrased Text Display - Always show when any text is extracted */}
          {extractedText && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Paraphrased Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={paraphrasedText}
                  onChange={(e) => setParaphrasedText(e.target.value)}
                  className="min-h-[200px]"
                  placeholder="Paraphrased text will appear here..."
                />
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