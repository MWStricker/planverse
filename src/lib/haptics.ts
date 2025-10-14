/**
 * Haptic Feedback Utility
 * Provides tactile feedback for mobile devices
 */

export const hapticFeedback = (type: 'light' | 'medium' | 'heavy' = 'light') => {
  if ('vibrate' in navigator) {
    const duration = type === 'light' ? 10 : type === 'medium' ? 20 : 30;
    navigator.vibrate(duration);
  }
};

export const hapticSuccess = () => hapticFeedback('light');
export const hapticError = () => hapticFeedback('heavy');
export const hapticSelection = () => hapticFeedback('light');
