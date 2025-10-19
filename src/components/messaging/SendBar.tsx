import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import { Upload, X, Smile } from "lucide-react";
import { cn } from "@/lib/utils";

interface SendBarProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => Promise<void>;
  onImageSelect: (file: File) => void;
  imagePreview?: string | null;
  onRemoveImage: () => void;
  uploading?: boolean;
  replyToMessage?: any | null;
  onCancelReply?: () => void;
  disabled?: boolean;
}

export function SendBar({
  value,
  onChange,
  onSend,
  onImageSelect,
  imagePreview,
  onRemoveImage,
  uploading = false,
  replyToMessage,
  onCancelReply,
  disabled = false
}: SendBarProps) {
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = async () => {
    const content = value.trim();
    if ((!content && !imagePreview) || sending || uploading) return;

    setSending(true);
    try {
      await onSend();
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageSelect(file);
    }
  };

  return (
    <div className="flex flex-col border-t bg-background">
      {/* Reply Preview */}
      {replyToMessage && (
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b">
          <div className="flex-1 text-sm">
            <p className="text-muted-foreground text-xs">Replying to</p>
            <p className="truncate">{replyToMessage.content}</p>
          </div>
          {onCancelReply && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancelReply}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {/* Image Preview */}
      {imagePreview && (
        <div className="relative w-20 h-20 m-3 mb-0 rounded-lg overflow-hidden border">
          <img 
            src={imagePreview} 
            alt="Upload preview" 
            className="w-full h-full object-cover"
          />
          <Button
            variant="destructive"
            size="sm"
            onClick={onRemoveImage}
            className="absolute top-1 right-1 h-6 w-6 p-0 rounded-full"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Input Area */}
      <div className="flex items-end gap-2 p-3">
        {/* File Upload Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          className="h-9 w-9 p-0 shrink-0"
        >
          <Upload className="h-4 w-4" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Message Input */}
        <AutoTextarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Message"
          disabled={disabled || uploading}
          className="flex-1 min-h-[36px] max-h-[120px]"
        />

        {/* Send Button */}
        <motion.div whileTap={{ scale: 0.92 }}>
          <Button
            onClick={handleSend}
            disabled={disabled || sending || uploading || (!value.trim() && !imagePreview)}
            size="sm"
            className={cn(
              "h-9 px-4 relative overflow-hidden",
              "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            Send
            {/* Subtle ripple effect on send */}
            {!sending && value.trim() && (
              <motion.span
                key={value.length}
                className="pointer-events-none absolute inset-0 rounded-md"
                initial={{ scale: 0, opacity: 0.25, background: "currentColor" }}
                animate={{ scale: 2, opacity: 0 }}
                transition={{ duration: 0.35 }}
              />
            )}
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
