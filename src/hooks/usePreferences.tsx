import { useState, useEffect } from 'react';

export interface UserPreferences {
  theme: 'default' | 'dark' | 'warm' | 'ocean' | 'forest' | 'sunset';
  boldText: boolean;
  textSize: 'small' | 'medium' | 'large';
}

const defaultPreferences: UserPreferences = {
  theme: 'default',
  boldText: false,
  textSize: 'medium',
};

export const usePreferences = () => {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);

  useEffect(() => {
    // Load preferences from localStorage
    const saved = localStorage.getItem('userPreferences');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPreferences({ ...defaultPreferences, ...parsed });
      } catch (error) {
        console.error('Failed to parse saved preferences:', error);
      }
    }
  }, []);

  useEffect(() => {
    // Apply preferences to document
    const root = document.documentElement;
    
    // Apply theme
    root.setAttribute('data-theme', preferences.theme);
    
    // Apply bold text
    if (preferences.boldText) {
      root.style.setProperty('--font-weight-normal', '600');
      root.style.setProperty('--font-weight-medium', '700');
      root.style.setProperty('--font-weight-semibold', '800');
      root.style.setProperty('--font-weight-bold', '900');
    } else {
      root.style.removeProperty('--font-weight-normal');
      root.style.removeProperty('--font-weight-medium');
      root.style.removeProperty('--font-weight-semibold');
      root.style.removeProperty('--font-weight-bold');
    }
    
    // Apply text size
    const sizeMap = {
      small: '0.875rem',
      medium: '1rem',
      large: '1.125rem'
    };
    root.style.setProperty('--base-font-size', sizeMap[preferences.textSize]);
    
    // Save to localStorage
    localStorage.setItem('userPreferences', JSON.stringify(preferences));
  }, [preferences]);

  const updatePreference = <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  return {
    preferences,
    updatePreference,
  };
};