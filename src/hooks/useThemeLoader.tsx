import { useEffect } from 'react';

// This hook applies theme preferences from localStorage immediately on app load
// to prevent flash of default theme before preferences load
export const useThemeLoader = () => {
  useEffect(() => {
    // Apply theme from localStorage immediately on app load
    const applyStoredTheme = () => {
      try {
        const stored = localStorage.getItem('userPreferences');
        if (stored) {
          const preferences = JSON.parse(stored);
          const root = document.documentElement;
          
          // Apply theme
          if (preferences.theme) {
            root.setAttribute('data-theme', preferences.theme);
            
            // Special handling for dark theme
            if (preferences.theme === 'dark') {
              root.classList.add('dark');
            } else {
              root.classList.remove('dark');
            }
          }
          
          // Apply bold text
          if (preferences.boldText) {
            root.style.setProperty('--font-weight-normal', '600');
            root.style.setProperty('--font-weight-medium', '700');
            root.style.setProperty('--font-weight-semibold', '800');
            root.style.setProperty('--font-weight-bold', '900');
          }
          
          // Apply text size
          const sizeMap = {
            small: '0.875rem',
            medium: '1rem',
            large: '1.125rem'
          };
          if (preferences.textSize && sizeMap[preferences.textSize as keyof typeof sizeMap]) {
            root.style.setProperty('--base-font-size', sizeMap[preferences.textSize as keyof typeof sizeMap]);
          }
        }
      } catch (error) {
        console.error('Failed to apply stored theme:', error);
      }
    };

    // Apply theme immediately
    applyStoredTheme();
  }, []);
};