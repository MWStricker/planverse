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
}

export const SortableTabItem = ({ 
  item, 
  isActive, 
  isReorderMode, 
  notifications = 0, 
  onClick 
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
      className={`w-full justify-start h-14 text-base transition-opacity duration-150 ${
        isDragging ? 'shadow-lg' : ''
      } ${
        isActive 
          ? 'bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg scale-[1.02] border-l-4 border-l-primary-foreground/20' 
          : 'text-foreground hover:bg-muted/30 hover:scale-[1.01]'
      } ${
        isReorderMode ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
      onClick={isReorderMode ? undefined : onClick}
      {...(isReorderMode ? { ...attributes, ...listeners } : {})}
    >
      {/* Shimmer effect for active items */}
      {isActive && !isReorderMode && (
        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
      )}
      
      <Icon className={`h-5 w-5 mr-3 transition-all duration-200 ease-out ${
        isActive 
          ? 'text-primary-foreground scale-110' 
          : 'group-hover:scale-105'
      }`} />
      <span className={`font-medium transition-all duration-150 ease-out ${
        isActive ? 'tracking-wide' : ''
      }`}>
        {item.label}
      </span>
      {item.id === 'tasks' && notifications > 0 && (
        <Badge 
          className="ml-auto bg-gradient-to-r from-accent to-accent/80 text-accent-foreground text-xs animate-pulse shadow-sm"
          variant="secondary"
        >
          {notifications}
        </Badge>
      )}
      
      {/* Glow effect for active items */}
      {isActive && !isReorderMode && (
        <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-primary/10 blur-sm -z-10 transition-all duration-300 ease-out"></div>
      )}
    </Button>
  );
};