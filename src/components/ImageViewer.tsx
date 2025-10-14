import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface ImageViewerProps {
  imageUrl: string | null;
  onClose: () => void;
}

export const ImageViewer = ({ imageUrl, onClose }: ImageViewerProps) => {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [initialPinchDistance, setInitialPinchDistance] = useState<number | null>(null);
  
  // Refs for smooth dragging without re-renders
  const imageRef = useRef<HTMLImageElement>(null);
  const positionRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const rafIdRef = useRef<number>();
  const containerRef = useRef<HTMLDivElement>(null);

  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 3;
  const ZOOM_STEP = 0.25;

  // Direct DOM transform update for 60fps
  const updateImageTransform = useCallback(() => {
    if (imageRef.current) {
      const { x, y } = positionRef.current;
      imageRef.current.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
    }
  }, [zoom]);

  // Reset on image change
  useEffect(() => {
    if (imageUrl) {
      setZoom(1);
      positionRef.current = { x: 0, y: 0 };
      setPosition({ x: 0, y: 0 });
      if (imageRef.current) {
        imageRef.current.style.transform = 'translate(0px, 0px) scale(1)';
      }
    }
  }, [imageUrl]);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!imageUrl) return;
      
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-') {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        handleReset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [imageUrl, zoom]);

  const handleZoomIn = useCallback(() => {
    setZoom(prev => {
      const newZoom = Math.min(prev + ZOOM_STEP, MAX_ZOOM);
      requestAnimationFrame(updateImageTransform);
      return newZoom;
    });
  }, [updateImageTransform]);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => {
      const newZoom = Math.max(prev - ZOOM_STEP, MIN_ZOOM);
      requestAnimationFrame(updateImageTransform);
      return newZoom;
    });
  }, [updateImageTransform]);

  const handleReset = useCallback(() => {
    setZoom(1);
    positionRef.current = { x: 0, y: 0 };
    setPosition({ x: 0, y: 0 });
    requestAnimationFrame(updateImageTransform);
  }, [updateImageTransform]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom(prev => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta)));
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX - positionRef.current.x,
      y: e.clientY - positionRef.current.y
    };
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grabbing';
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    
    // Cancel previous RAF if still pending
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
    }
    
    // Update position ref (no React re-render)
    positionRef.current = {
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    };
    
    // Schedule DOM update for next frame
    rafIdRef.current = requestAnimationFrame(updateImageTransform);
  }, [updateImageTransform]);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    // Sync ref state back to React state (for reset button)
    setPosition({ ...positionRef.current });
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grab';
    }
  }, []);

  const handleDoubleClick = useCallback(() => {
    if (zoom === 1) {
      setZoom(2);
      requestAnimationFrame(updateImageTransform);
    } else {
      handleReset();
    }
  }, [zoom, handleReset, updateImageTransform]);

  // Touch handling for pinch zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setInitialPinchDistance(distance);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistance) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = distance / initialPinchDistance;
      setZoom(prev => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev * scale)));
      setInitialPinchDistance(distance);
    }
  };

  const handleTouchEnd = () => {
    setInitialPinchDistance(null);
  };

  return (
    <Dialog open={!!imageUrl} onOpenChange={() => onClose()}>
      <DialogContent 
        className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 bg-black/95 border-none"
        hideCloseButton={false}
      >
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Zoom Controls */}
          <div className="absolute top-4 right-4 z-10 flex gap-2">
            <Button
              size="icon"
              variant="secondary"
              onClick={handleZoomOut}
              disabled={zoom <= MIN_ZOOM}
              className="bg-background/80 hover:bg-background"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              onClick={handleZoomIn}
              disabled={zoom >= MAX_ZOOM}
              className="bg-background/80 hover:bg-background"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              onClick={handleReset}
              className="bg-background/80 hover:bg-background"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Zoom Level Indicator */}
          <div className="absolute top-4 left-4 z-10 bg-background/80 px-3 py-1.5 rounded-md text-sm font-medium">
            {Math.round(zoom * 100)}%
          </div>

          {/* Image Container */}
          <div
            ref={containerRef}
            className="w-full h-full flex items-center justify-center overflow-hidden"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={handleDoubleClick}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ cursor: 'grab' }}
          >
            <img
              ref={imageRef}
              src={imageUrl || ''}
              alt="Full size"
              className="max-w-full max-h-full object-contain select-none"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                willChange: 'transform',
              }}
              draggable={false}
            />
          </div>

          {/* Instructions */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/80 px-4 py-2 rounded-md text-xs text-muted-foreground">
            <span className="hidden md:inline">Scroll to zoom • Double-click to reset • Drag to pan</span>
            <span className="md:hidden">Pinch to zoom • Double-tap to reset • Drag to pan</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
