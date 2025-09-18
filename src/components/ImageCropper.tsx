import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { RotateCw, ZoomIn, ZoomOut, Move, Crop, X } from 'lucide-react';

interface ImageCropperProps {
  open: boolean;
  onClose: () => void;
  imageFile: File;
  onCrop: (croppedBlob: Blob) => void;
}

export const ImageCropper = ({ open, onClose, imageFile, onCrop }: ImageCropperProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cropSize] = useState(200); // Fixed square crop size

  // Load image when file changes
  useEffect(() => {
    if (!imageFile) return;

    const img = new Image();
    img.onload = () => {
      setImage(img);
      // Reset transforms when new image loads
      setScale(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
    };
    img.src = URL.createObjectURL(imageFile);

    return () => {
      URL.revokeObjectURL(img.src);
    };
  }, [imageFile]);

  // Draw image on canvas
  useEffect(() => {
    if (!image || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = 400;
    canvas.height = 400;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Save context
    ctx.save();

    // Move to center
    ctx.translate(canvas.width / 2, canvas.height / 2);

    // Apply transformations
    ctx.scale(scale, scale);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(position.x, position.y);

    // Calculate image dimensions to fit canvas while maintaining aspect ratio
    const maxSize = Math.min(300, canvas.width - 100, canvas.height - 100);
    const aspectRatio = image.width / image.height;
    let drawWidth, drawHeight;

    if (aspectRatio > 1) {
      drawWidth = maxSize;
      drawHeight = maxSize / aspectRatio;
    } else {
      drawWidth = maxSize * aspectRatio;
      drawHeight = maxSize;
    }

    // Draw image centered
    ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

    // Restore context
    ctx.restore();

    // Draw crop overlay
    const cropX = (canvas.width - cropSize) / 2;
    const cropY = (canvas.height - cropSize) / 2;

    // Draw dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Clear crop area
    ctx.clearRect(cropX, cropY, cropSize, cropSize);

    // Draw crop border
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.strokeRect(cropX, cropY, cropSize, cropSize);

    // Draw corner indicators
    const cornerSize = 10;
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(cropX - cornerSize/2, cropY - cornerSize/2, cornerSize, cornerSize);
    ctx.fillRect(cropX + cropSize - cornerSize/2, cropY - cornerSize/2, cornerSize, cornerSize);
    ctx.fillRect(cropX - cornerSize/2, cropY + cropSize - cornerSize/2, cornerSize, cornerSize);
    ctx.fillRect(cropX + cropSize - cornerSize/2, cropY + cropSize - cornerSize/2, cornerSize, cornerSize);
  }, [image, scale, rotation, position, cropSize]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsDragging(true);
    setDragStart({ x: x - position.x, y: y - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setPosition({
      x: x - dragStart.x,
      y: y - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleCrop = () => {
    if (!image || !canvasRef.current) return;

    // Create a new canvas for the cropped image
    const cropCanvas = document.createElement('canvas');
    const cropCtx = cropCanvas.getContext('2d');
    if (!cropCtx) return;

    // Set crop canvas size to desired output size
    const outputSize = 200;
    cropCanvas.width = outputSize;
    cropCanvas.height = outputSize;

    // Get the main canvas for reference
    const mainCanvas = canvasRef.current;
    const cropX = (mainCanvas.width - cropSize) / 2;
    const cropY = (mainCanvas.height - cropSize) / 2;

    // Calculate the transform matrix
    const centerX = mainCanvas.width / 2;
    const centerY = mainCanvas.height / 2;

    // Calculate image dimensions
    const maxSize = Math.min(300, mainCanvas.width - 100, mainCanvas.height - 100);
    const aspectRatio = image.width / image.height;
    let drawWidth, drawHeight;

    if (aspectRatio > 1) {
      drawWidth = maxSize;
      drawHeight = maxSize / aspectRatio;
    } else {
      drawWidth = maxSize * aspectRatio;
      drawHeight = maxSize;
    }

    // Calculate the source coordinates on the original image
    const scaleX = image.width / drawWidth;
    const scaleY = image.height / drawHeight;

    // Account for transformations
    const sourceX = ((cropX - centerX - position.x) / scale) * scaleX + image.width / 2;
    const sourceY = ((cropY - centerY - position.y) / scale) * scaleY + image.height / 2;
    const sourceWidth = (cropSize / scale) * scaleX;
    const sourceHeight = (cropSize / scale) * scaleY;

    // Draw the cropped portion
    try {
      cropCtx.drawImage(
        image,
        Math.max(0, sourceX),
        Math.max(0, sourceY),
        Math.min(sourceWidth, image.width - Math.max(0, sourceX)),
        Math.min(sourceHeight, image.height - Math.max(0, sourceY)),
        0,
        0,
        outputSize,
        outputSize
      );

      // Convert to blob and call onCrop
      cropCanvas.toBlob((blob) => {
        if (blob) {
          onCrop(blob);
        }
      }, 'image/jpeg', 0.9);
    } catch (error) {
      console.error('Error cropping image:', error);
    }
  };

  const resetTransforms = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crop className="h-5 w-5" />
            Crop Profile Picture
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Canvas */}
          <div className="flex justify-center">
            <canvas
              ref={canvasRef}
              className="border border-border rounded-lg cursor-move"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          </div>

          {/* Controls */}
          <div className="space-y-4">
            {/* Zoom Control */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ZoomOut className="h-4 w-4" />
                <span className="text-sm font-medium">Zoom</span>
                <ZoomIn className="h-4 w-4" />
              </div>
              <Slider
                value={[scale]}
                onValueChange={([value]) => setScale(value)}
                min={0.5}
                max={3}
                step={0.1}
                className="w-full"
              />
            </div>

            {/* Rotation Control */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <RotateCw className="h-4 w-4" />
                <span className="text-sm font-medium">Rotation</span>
              </div>
              <Slider
                value={[rotation]}
                onValueChange={([value]) => setRotation(value)}
                min={-180}
                max={180}
                step={5}
                className="w-full"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={resetTransforms}
                className="flex items-center gap-2"
              >
                <Move className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>

          <div className="text-xs text-muted-foreground text-center">
            Drag the image to reposition it within the crop area. Use zoom and rotation controls to adjust.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleCrop} className="flex items-center gap-2">
            <Crop className="h-4 w-4" />
            Crop & Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};