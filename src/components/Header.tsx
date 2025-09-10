import React from 'react';

interface HeaderProps {
  className?: string;
}

export const Header = ({ className = "" }: HeaderProps) => {
  return (
    <header className={`w-full bg-card border-b border-border ${className} relative`}>
      <div className="container mx-auto px-6 py-4">
        <div className="flex justify-center">
          <h1 className="text-4xl font-bold text-foreground">Course Connect</h1>
        </div>
      </div>
    </header>
  );
};