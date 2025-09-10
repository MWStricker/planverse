import React from 'react';

interface HeaderProps {
  className?: string;
}

export const Header = ({ className = "" }: HeaderProps) => {
  return (
    <header className={`w-full bg-card border-b border-border ${className} relative`}>
      <div className="fixed -top-6 left-0 w-48 h-48 overflow-hidden flex items-start justify-start z-50">
        <img 
          src="/lovable-uploads/a3ff9ac9-6bac-424f-a880-22b8b42de5c3.png" 
          alt="CourseConnect Logo" 
          className="w-32 h-32 object-cover object-center"
        />
      </div>
      
      <div className="container mx-auto px-6 py-6">
        <div className="flex justify-center">
          <h1 className="text-5xl font-semibold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent hover-scale">
            Course Connect
          </h1>
        </div>
      </div>
    </header>
  );
};