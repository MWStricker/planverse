import React from 'react';
import { Button } from "@/components/ui/button";
import { Settings, Save, X } from "lucide-react";

interface HeaderProps {
  className?: string;
  isReorderMode?: boolean;
  onToggleReorder?: () => void;
  onSaveOrder?: () => void;
  onCancelReorder?: () => void;
}

export const Header = ({ 
  className = "", 
  isReorderMode = false,
  onToggleReorder,
  onSaveOrder,
  onCancelReorder
}: HeaderProps) => {
  return (
    <header className={`w-full bg-gradient-to-r from-background via-card to-background border-b border-border/50 shadow-sm ${className} relative`}>
      <div className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          {/* Left side - Reorder button */}
          <div className="flex items-center gap-2">
            {!isReorderMode ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleReorder}
                className="flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                Reorder Tabs
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onCancelReorder}
                  className="flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={onSaveOrder}
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Save Order
                </Button>
              </div>
            )}
          </div>
          
          {/* Center - Course Connect title */}
          <div className="flex justify-center flex-1">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-primary via-primary/80 to-secondary bg-clip-text text-transparent tracking-tight hover:scale-105 transition-transform duration-300 cursor-default">
              Course Connect
            </h1>
          </div>
          
          {/* Right side - spacer for balance */}
          <div className="w-[140px]"></div>
        </div>
        
        {isReorderMode && (
          <div className="mt-4 p-3 bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg border-2 border-dashed border-primary/30 animate-fade-in">
            <div className="flex items-center justify-center gap-2">
              <p className="text-sm text-foreground font-medium">
                Drag and drop navigation tabs to reorder them
              </p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};