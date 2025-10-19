import { useMemo } from 'react';
import { useStatusFab } from '@/hooks/useStatusFab';
import './StatusFab.css';

export const StatusFab = () => {
  const { settings, isLoading, updateStatus } = useStatusFab();

  const positionStyle = useMemo(() => {
    const offset = `${settings.offset}px`;
    switch (settings.position) {
      case 'tl':
        return {
          top: `max(${offset}, env(safe-area-inset-top))`,
          left: `max(${offset}, env(safe-area-inset-left))`,
        };
      case 'tr':
        return {
          top: `max(${offset}, env(safe-area-inset-top))`,
          right: `max(${offset}, env(safe-area-inset-right))`,
        };
      case 'bl':
        return {
          bottom: `max(${offset}, env(safe-area-inset-bottom))`,
          left: `max(${offset}, env(safe-area-inset-left))`,
        };
      case 'br':
      default:
        return {
          bottom: `max(${offset}, env(safe-area-inset-bottom))`,
          right: `max(${offset}, env(safe-area-inset-right))`,
        };
    }
  }, [settings.position, settings.offset]);

  if (isLoading) return null;

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    // Add pulse animation
    e.currentTarget.classList.add('pulse');
    setTimeout(() => e.currentTarget.classList.remove('pulse'), 250);

    // Toggle status
    await updateStatus(!settings.online);
  };

  return (
    <button
      className={`status-fab ${settings.online ? 'is-online' : 'is-offline'}`}
      style={positionStyle as any}
      onClick={handleClick}
      aria-pressed={settings.online}
      aria-label={
        settings.online
          ? 'Online. Click to go offline.'
          : 'Offline. Click to go online.'
      }
    >
      <span className="dot" />
    </button>
  );
};
