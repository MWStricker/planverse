import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface CustomInputProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
}

export const CustomInput = React.forwardRef<HTMLDivElement, CustomInputProps>(
  ({ className, value = "", onChange, placeholder, id, disabled, ...props }, ref) => {
    const autoId = React.useId();
    const inputId = id || autoId;
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
      if (e.key === 'Enter') {
        e.preventDefault();
      }
    };

    return (
      <div
        ref={ref}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          focused && "ring-2 ring-ring ring-offset-2",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
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
          id={inputId}
          className="w-full outline-none bg-transparent min-h-[1.25rem] empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:pointer-events-none"
          data-placeholder={!value ? placeholder : undefined}
        />
      </div>
    );
  }
);

CustomInput.displayName = "CustomInput";