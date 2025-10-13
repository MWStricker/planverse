import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

export interface TabItem {
  id: string;
  label: string;
  icon: any;
}

const defaultTabOrder = [
  'connect',
  'dashboard',
  'calendar', 
  'courses',
  'tasks',
  'upload'
];

export const useTabReorder = (navItems: TabItem[]) => {
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [tabOrder, setTabOrder] = useState<string[]>(defaultTabOrder);
  const { user } = useAuth();
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Start dragging after 8px of movement
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load saved tab order
  useEffect(() => {
    if (!user?.id) return;

    const loadTabOrder = async () => {
      const { data } = await supabase
        .from('user_settings')
        .select('settings_data')
        .eq('user_id', user.id)
        .eq('settings_type', 'tab_order')
        .maybeSingle();

      if (data?.settings_data && typeof data.settings_data === 'object' && 'order' in data.settings_data) {
        setTabOrder((data.settings_data as { order: string[] }).order);
      }
    };

    loadTabOrder();
  }, [user?.id]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = tabOrder.findIndex(id => id === active.id);
      const newIndex = tabOrder.findIndex(id => id === over?.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(tabOrder, oldIndex, newIndex);
        setTabOrder(newOrder);
        
        // Auto-save the new order
        if (user?.id) {
          try {
            const { error } = await supabase
              .from('user_settings')
              .upsert({
                user_id: user.id,
                settings_type: 'tab_order',
                settings_data: { order: newOrder } as any
              }, {
                onConflict: 'user_id,settings_type'
              });

            if (error) {
              console.error('Error auto-saving tab order:', error);
              toast({
                title: "Error",
                description: "Failed to save tab order",
                variant: "destructive",
              });
            } else {
              toast({
                title: "Tab reordered",
                description: "Changes saved automatically",
                duration: 2000,
              });
            }
          } catch (error) {
            console.error('Error auto-saving tab order:', error);
          }
        }
      }
    }
  };

  const saveTabOrder = async () => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          settings_type: 'tab_order',
          settings_data: { order: tabOrder } as any
        }, {
          onConflict: 'user_id,settings_type'
        });

      if (error) {
        console.error('Error saving tab order:', error);
        toast({
          title: "Error",
          description: "Failed to save tab order",
          variant: "destructive",
        });
        return;
      }

      setIsReorderMode(false);
      toast({
        title: "Success",
        description: "Tab order saved successfully",
      });
    } catch (error) {
      console.error('Error saving tab order:', error);
    }
  };

  const cancelReorder = () => {
    setIsReorderMode(false);
    // Reset to original order by reloading from database
    if (user?.id) {
      const loadTabOrder = async () => {
        const { data } = await supabase
          .from('user_settings')
          .select('settings_data')
          .eq('user_id', user.id)
          .eq('settings_type', 'tab_order')
          .maybeSingle();

        if (data?.settings_data && typeof data.settings_data === 'object' && 'order' in data.settings_data) {
          setTabOrder((data.settings_data as { order: string[] }).order);
        } else {
          setTabOrder(defaultTabOrder);
        }
      };
      loadTabOrder();
    }
  };

  // Get ordered nav items based on saved order
  const getOrderedNavItems = () => {
    const orderedItems = tabOrder.map(id => navItems.find(item => item.id === id)).filter(Boolean) as TabItem[];
    // Add any new items that might not be in the saved order
    const missingItems = navItems.filter(item => !tabOrder.includes(item.id));
    return [...orderedItems, ...missingItems];
  };

  return {
    isReorderMode,
    setIsReorderMode,
    tabOrder,
    sensors,
    handleDragEnd,
    saveTabOrder,
    cancelReorder,
    getOrderedNavItems,
    DndContext,
    SortableContext,
    verticalListSortingStrategy,
    closestCenter
  };
};