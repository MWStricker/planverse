import React from 'react';

interface HeaderProps {
  className?: string;
}

export const Header = ({ className = "" }: HeaderProps) => {
  return (
    <header className={`w-full bg-card border-b border-border ${className}`}>
      <div className="container mx-auto px-6 py-6 relative">
        <div className="absolute top-6 left-6 w-40 h-40 overflow-hidden rounded-lg flex items-center justify-center">
          <img 
            src="/lovable-uploads/a3ff9ac9-6bac-424f-a880-22b8b42de5c3.png" 
            alt="CourseConnect Logo" 
            className="w-24 h-24 object-cover object-center"
          />
        </div>
        
        <div className="flex justify-center">
          <h1 className="text-6xl font-bold text-foreground">Course Connect</h1>
        </div>
      </div>
    </header>
  );
};