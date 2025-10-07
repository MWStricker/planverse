import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SortableTabItemProps {
  item: {
    id: string;
    label: string;
    icon: any;
  };
  isActive: boolean;
  isReorderMode: boolean;
  notifications?: number;
  onClick: () => void;
  isCollapsed?: boolean;
}

export const SortableTabItem = ({ 
  item, 
  isActive, 
  isReorderMode, 
  notifications = 0, 
  onClick,
  isCollapsed = false
}: SortableTabItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: item.id,
    disabled: !isReorderMode 
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : undefined,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  const Icon = item.icon;

  return (
    <Button
      ref={setNodeRef}
      style={style}
      variant={isActive ? "default" : "ghost"}
      className={`w-full h-20 max-md:h-12 text-lg max-md:text-sm transition-[background-color,transform,box-shadow] duration-200 ease-out focus:outline-none focus-visible:outline-none will-change-[background,transform] ${
        isCollapsed ? 'justify-center px-2' : 'justify-start px-6 max-md:px-3'
      } ${
        isDragging ? 'shadow-lg' : ''
      } ${
        isActive 
          ? 'bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg scale-[1.02] max-md:scale-100 border-l-4 max-md:border-l-2 border-l-primary-foreground/20' 
          : 'text-foreground hover:bg-muted/30 hover:scale-[1.01] max-md:hover:scale-100'
      } ${
        isReorderMode ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
      onClick={isReorderMode ? undefined : (e) => {
        e.currentTarget.blur(); // Remove focus after click
        onClick();
      }}
      {...(isReorderMode ? { ...attributes, ...listeners } : {})}
    >
      {/* Shimmer effect for active items */}
      {isActive && !isReorderMode && (
        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
      )}
      
      <Icon className={`h-5 w-5 max-md:h-4 max-md:w-4 transition-[margin,transform] duration-200 ease-out will-change-[margin,transform] flex-shrink-0 ${
        isCollapsed ? '' : 'mr-3 max-md:mr-2'
      } ${
        isActive 
          ? 'text-primary-foreground scale-110 max-md:scale-105' 
          : ''
      }`} />
      
      {!isCollapsed && (
        <div className="flex items-center transition-opacity duration-150 ease-out opacity-100 min-w-0 flex-1">
          <span className={`font-medium truncate ${
            isActive ? 'tracking-wide max-md:tracking-normal' : ''
          }`}>
            {item.label}
          </span>
          {item.id === 'tasks' && notifications > 0 && (
            <Badge 
              className="ml-auto flex-shrink-0 bg-gradient-to-r from-accent to-accent/80 text-accent-foreground text-xs max-md:text-[10px] animate-pulse shadow-sm max-md:px-1.5 max-md:py-0"
              variant="secondary"
            >
              {notifications}
            </Badge>
          )}
        </div>
      )}
      
      {/* Show notification as a dot when collapsed */}
      {isCollapsed && item.id === 'tasks' && notifications > 0 && (
        <div className="absolute -top-1 -right-1 w-3 h-3 max-md:w-2 max-md:h-2 bg-accent rounded-full animate-pulse shadow-sm"></div>
      )}
      
      {/* Glow effect for active items - hidden on mobile for performance */}
      {isActive && !isReorderMode && (
        <div className="max-md:hidden absolute -inset-1 bg-gradient-to-r from-primary/20 to-primary/10 blur-sm -z-10 transition-opacity duration-200 ease-out"></div>
      )}
    </Button>
  );
};