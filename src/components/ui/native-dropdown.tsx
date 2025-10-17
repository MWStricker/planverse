import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface NativeDropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  align?: 'start' | 'end' | 'center';
  triggerClassName?: string;
  label: string;
}

export const NativeDropdown: React.FC<NativeDropdownProps> = ({
  trigger,
  children,
  className,
  align = 'end',
  triggerClassName,
  label,
}) => {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useRef(`menu-${Math.random().toString(36).substr(2, 9)}`);
  const btnId = useRef(`menu-button-${Math.random().toString(36).substr(2, 9)}`);

  // Close on outside click
  useEffect(() => {
    if (!open) return;

    const handleOutsideClick = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current &&
        btnRef.current &&
        !menuRef.current.contains(target) &&
        !btnRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handleOutsideClick, { capture: true });
    return () => document.removeEventListener('pointerdown', handleOutsideClick, { capture: true });
  }, [open]);

  // Focus management when opening
  useEffect(() => {
    if (open && menuRef.current) {
      const firstItem = menuRef.current.querySelector('[role="menuitem"]') as HTMLElement;
      if (firstItem) {
        firstItem.setAttribute('tabindex', '0');
        setTimeout(() => firstItem.focus(), 0);
      }
    } else if (!open && btnRef.current) {
      btnRef.current.focus();
    }
  }, [open]);

  const handleToggle = () => {
    setOpen(!open);
  };

  const handleButtonKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
    }
  };

  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        id={btnId.current}
        className={cn(
          "inline-flex items-center justify-center gap-2",
          "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          triggerClassName
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId.current}
        aria-label={label}
        onClick={handleToggle}
        onKeyDown={handleButtonKeyDown}
      >
        {trigger}
      </button>

      {open && (
        <NativeDropdownMenu
          ref={menuRef}
          id={menuId.current}
          labelledBy={btnId.current}
          className={className}
          align={align}
          onClose={() => setOpen(false)}
        >
          {children}
        </NativeDropdownMenu>
      )}
    </div>
  );
};

interface NativeDropdownMenuProps {
  id: string;
  labelledBy: string;
  children: React.ReactNode;
  className?: string;
  align?: 'start' | 'end' | 'center';
  onClose: () => void;
}

const NativeDropdownMenu = React.forwardRef<HTMLDivElement, NativeDropdownMenuProps>(
  ({ id, labelledBy, children, className, align = 'end', onClose }, ref) => {
    const items = useRef<HTMLElement[]>([]);

    useEffect(() => {
      const menuElement = (ref as React.RefObject<HTMLDivElement>)?.current;
      if (menuElement) {
        items.current = Array.from(menuElement.querySelectorAll('[role="menuitem"]'));
        items.current.forEach(item => item.setAttribute('tabindex', '-1'));
        if (items.current[0]) {
          items.current[0].setAttribute('tabindex', '0');
        }
      }
    }, [ref, children]);

    const focusItem = useCallback((index: number) => {
      items.current.forEach(item => item.setAttribute('tabindex', '-1'));
      const item = items.current[index];
      if (item) {
        item.setAttribute('tabindex', '0');
        item.focus();
      }
    }, []);

    const currentIndex = useCallback(() => {
      return items.current.findIndex(item => item.getAttribute('tabindex') === '0');
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
      const idx = currentIndex();
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          focusItem(Math.min(idx + 1, items.current.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          focusItem(Math.max(idx - 1, 0));
          break;
        case 'Home':
          e.preventDefault();
          focusItem(0);
          break;
        case 'End':
          e.preventDefault();
          focusItem(items.current.length - 1);
          break;
        case 'Tab':
          onClose();
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    const alignmentClasses = {
      start: 'left-0',
      end: 'right-0',
      center: 'left-1/2 -translate-x-1/2',
    };

    return (
      <div
        ref={ref}
        id={id}
        role="menu"
        aria-labelledby={labelledBy}
        className={cn(
          "absolute top-[calc(100%+6px)] min-w-[180px]",
          "bg-popover border border-border rounded-md shadow-md",
          "p-1.5 z-50",
          "animate-in fade-in-0 zoom-in-95",
          alignmentClasses[align],
          className
        )}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    );
  }
);

NativeDropdownMenu.displayName = 'NativeDropdownMenu';

interface NativeDropdownItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  destructive?: boolean;
}

export const NativeDropdownItem: React.FC<NativeDropdownItemProps> = ({
  children,
  onClick,
  className,
  destructive = false,
}) => {
  const handleClick = () => {
    onClick?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <button
      role="menuitem"
      type="button"
      className={cn(
        "flex items-center w-full text-left px-2 py-2 text-sm rounded-sm",
        "transition-colors cursor-pointer outline-none",
        "hover:bg-accent hover:text-accent-foreground",
        "focus:bg-accent focus:text-accent-foreground",
        destructive && "text-destructive hover:text-destructive focus:text-destructive",
        className
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {children}
    </button>
  );
};
