import React from 'react';

interface HeaderProps {
  className?: string;
}

export const Header = ({ className = "" }: HeaderProps) => {
  return (
    <header className={`w-full bg-gradient-to-r from-background via-card to-background border-b border-border/50 shadow-sm ${className} relative`}>
      <div className="container mx-auto px-6 py-6">
        <div className="flex justify-center">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary via-primary/80 to-secondary bg-clip-text text-transparent tracking-tight hover:scale-105 transition-transform duration-300 cursor-default">
            Course Connect
          </h1>
        </div>
      </div>
    </header>
  );
};