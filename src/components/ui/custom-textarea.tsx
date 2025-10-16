import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface CustomTextareaProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
  rows?: number;
}

export const CustomTextarea = React.forwardRef<HTMLDivElement, CustomTextareaProps>(
  ({ className, value = "", onChange, placeholder, id, disabled, rows = 4, ...props }, ref) => {
    const autoId = React.useId();
    const textareaId = id || autoId;
    const [focused, setFocused] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (contentRef.current && contentRef.current.textContent !== value) {
        contentRef.current.textContent = value;
      }
    }, [value]);

    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
      const newValue = e.currentTarget.textContent || "";
      onChange?.(newValue);
    };

    const handleFocus = () => {
      setFocused(true);
    };

    const handleBlur = () => {
      setFocused(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      // Allow normal textarea behavior like Enter for new lines
      if (e.key === 'Tab') {
        e.preventDefault();
        document.execCommand('insertText', false, '  ');
      }
    };

    return (
      <div
        ref={ref}
        className={cn(
          "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          focused && "ring-2 ring-ring ring-offset-2",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
        style={{ minHeight: `${rows * 1.5}rem` }}
        {...props}
      >
        <div
          ref={contentRef}
          contentEditable={!disabled}
          suppressContentEditableWarning={true}
          onInput={handleInput}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          id={textareaId}
          className="w-full outline-none bg-transparent min-h-full whitespace-pre-wrap break-words empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:pointer-events-none"
          data-placeholder={!value ? placeholder : undefined}
        />
      </div>
    );
  }
);

CustomTextarea.displayName = "CustomTextarea";