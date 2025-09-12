import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Aggressive autofill prevention
const disableAutofill = () => {
  // Disable autofill on all existing inputs
  const inputs = document.querySelectorAll('input, textarea');
  inputs.forEach((input: any) => {
    input.setAttribute('autocomplete', 'new-password');
    input.setAttribute('data-form-type', 'other');
    input.setAttribute('data-1p-ignore', 'true');
    input.setAttribute('data-lpignore', 'true');
    input.setAttribute('data-bwignore', 'true');
  });
  
  // Override browser autofill behaviors
  if (typeof window !== 'undefined') {
    // Prevent autofill on form submission
    document.addEventListener('submit', (e) => {
      const form = e.target as HTMLFormElement;
      if (form) {
        form.setAttribute('autocomplete', 'off');
      }
    });
    
    // Monitor for new inputs being added to DOM
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node: any) => {
          if (node.nodeType === 1) { // Element node
            const inputs = node.querySelectorAll ? node.querySelectorAll('input, textarea') : [];
            inputs.forEach((input: any) => {
              input.setAttribute('autocomplete', 'new-password');
              input.setAttribute('data-form-type', 'other');
              input.setAttribute('data-1p-ignore', 'true');
              input.setAttribute('data-lpignore', 'true');
              input.setAttribute('data-bwignore', 'true');
            });
          }
        });
      });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
  }
};

// Run immediately and after DOM loads
disableAutofill();
document.addEventListener('DOMContentLoaded', disableAutofill);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
