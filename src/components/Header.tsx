import React from 'react';

interface HeaderProps {
  className?: string;
}

export const Header = ({ className = "" }: HeaderProps) => {
  return (
    <header className={`w-full bg-card border-b border-border ${className}`}>
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Course Connect</h1>
        
        <div className="w-16 h-16 overflow-hidden rounded-lg">
          <img 
            src="/lovable-uploads/a3ff9ac9-6bac-424f-a880-22b8b42de5c3.png" 
            alt="CourseConnect Logo" 
            className="w-20 h-20 object-cover object-center scale-125"
          />
        </div>
      </div>
    </header>
  );
};