import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { NotificationCenter } from '@/components/NotificationCenter';
import { BrowserRouter } from 'react-router-dom';

describe('Notification Badge Visibility', () => {
  it('should have no overflow clipping on badge ancestors', () => {
    const { container } = render(
      <BrowserRouter>
        <NotificationCenter />
      </BrowserRouter>
    );
    
    // Find all ancestors of the badge
    const badge = container.querySelector('[class*="absolute"][class*="-top"]');
    if (!badge) return; // No badge rendered when count is 0
    
    let element = badge.parentElement;
    while (element && element !== document.body) {
      const styles = window.getComputedStyle(element);
      
      // Check for clipping properties
      expect(styles.overflow).not.toBe('hidden');
      expect(styles.overflow).not.toBe('clip');
      expect(styles.clipPath).toBe('none');
      expect(styles.maskImage).toBe('none');
      
      element = element.parentElement;
    }
  });
  
  it('should have z-index >= 1000 on badge', () => {
    const { container } = render(
      <BrowserRouter>
        <NotificationCenter />
      </BrowserRouter>
    );
    const badge = container.querySelector('[class*="z-"]');
    
    if (badge) {
      const styles = window.getComputedStyle(badge);
      const zIndex = parseInt(styles.zIndex, 10);
      expect(zIndex).toBeGreaterThanOrEqual(1000);
    }
  });
  
  it('should have overflow-visible on button wrapper', () => {
    const { container } = render(
      <BrowserRouter>
        <NotificationCenter />
      </BrowserRouter>
    );
    const button = container.querySelector('button');
    
    if (button) {
      const styles = window.getComputedStyle(button);
      expect(styles.overflow).toBe('visible');
    }
  });
});
