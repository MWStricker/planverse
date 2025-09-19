import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Fix viewport height for Mac/Safari browsers
const setAppHeight = () => {
  const doc = document.documentElement;
  doc.style.setProperty('--app-height', `${window.innerHeight}px`);
};

// Simple autofill prevention - just make sure no input looks like an email field
const preventEmailAutofill = () => {
  const observer = new MutationObserver(() => {
    const inputs = document.querySelectorAll('input:not([data-autofill-processed])');
    inputs.forEach((input: any) => {
      // Mark as processed
      input.setAttribute('data-autofill-processed', 'true');
      
      // Only apply to non-email inputs to prevent email autofill on task forms
      if (input.type !== 'email') {
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('data-form-type', 'other');
        
        // Make sure Chrome doesn't think this is an email field
        if (input.name && (input.name.includes('email') || input.name.includes('user'))) {
          input.name = `task-${input.name}-${Date.now()}`;
        }
      }
    });
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
};

// Set initial height and listen for resize events
setAppHeight();
window.addEventListener('resize', setAppHeight);
window.addEventListener('orientationchange', setAppHeight);

// Run after DOM loads
document.addEventListener('DOMContentLoaded', preventEmailAutofill);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
