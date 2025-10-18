import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  const [isMounted, setIsMounted] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useRef(`menu-${Math.random().toString(36).substr(2, 9)}`);
  const btnId = useRef(`menu-button-${Math.random().toString(36).substr(2, 9)}`);

  // Set mounted state for client-side rendering
  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  // Calculate position when opening
  const updatePosition = useCallback(() => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 6,
        left: rect.left,
        right: window.innerWidth - rect.right,
      });
    }
  }, []);

  const handleToggle = () => {
    if (!open) {
      updatePosition();
    }
    setOpen(!open);
  };

  // Close on scroll, update position on resize
  useEffect(() => {
    if (!open) return;

    const handleScroll = () => {
      setOpen(false);
    };

    const handleResize = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [open, updatePosition]);

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

      {open && isMounted && typeof document !== 'undefined' && document.body && createPortal(
        <NativeDropdownMenu
          ref={menuRef}
          id={menuId.current}
          labelledBy={btnId.current}
          className={className}
          align={align}
          position={position}
          onClose={() => setOpen(false)}
        >
          {children}
        </NativeDropdownMenu>,
        document.body
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
  position: { top: number; left: number; right: number };
  onClose: () => void;
}

const NativeDropdownMenu = React.forwardRef<HTMLDivElement, NativeDropdownMenuProps>(
  ({ id, labelledBy, children, className, align = 'end', position, onClose }, ref) => {
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

    const getAlignmentStyle = () => {
      switch (align) {
        case 'start':
          return { top: position.top, left: position.left };
        case 'end':
          return { top: position.top, right: position.right };
        case 'center':
          return { 
            top: position.top, 
            left: position.left + (window.innerWidth - position.left - position.right) / 2,
            transform: 'translateX(-50%)'
          };
        default:
          return { top: position.top, right: position.right };
      }
    };

    return (
      <div
        ref={ref}
        id={id}
        role="menu"
        aria-labelledby={labelledBy}
        style={getAlignmentStyle()}
        className={cn(
          "fixed min-w-[180px]",
          "bg-popover border border-border rounded-md shadow-md",
          "p-1.5 z-[100]",
          "animate-in fade-in-0 zoom-in-95",
          "pointer-events-auto",
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
  checked?: boolean;
  disabled?: boolean;
}

export const NativeDropdownItem: React.FC<NativeDropdownItemProps> = ({
  children,
  onClick,
  className,
  destructive = false,
  checked = false,
  disabled = false,
}) => {
  const handleClick = () => {
    if (!disabled) {
      onClick?.();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!disabled) {
        onClick?.();
      }
    }
  };

  return (
    <button
      role="menuitem"
      type="button"
      aria-checked={checked ? 'true' : undefined}
      aria-disabled={disabled}
      className={cn(
        "flex items-center gap-2 w-full text-left px-2 py-2 text-sm rounded-sm",
        "transition-colors outline-none",
        !disabled && "cursor-pointer hover:bg-muted/50 focus:bg-muted/50",
        disabled && "opacity-50 cursor-not-allowed",
        destructive && !disabled && "text-destructive hover:text-destructive focus:text-destructive",
        className
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

export const NativeDropdownSeparator: React.FC<{ className?: string }> = ({ className }) => (
  <hr className={cn("my-1 border-t border-border", className)} role="separator" />
);
