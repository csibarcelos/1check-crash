

import React from 'react';
import { createRoot } from 'react-dom/client'; 
import { RouterProvider } from 'react-router-dom'; // Corrected import
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { Toaster } from '@/components/ui/Toast';
import '@/global.css';
import { router } from '@/router'; 

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AuthProvider>
      <ToastProvider>
        <RouterProvider router={router} />
        <Toaster />
      </ToastProvider>
    </AuthProvider>
  </React.StrictMode>
);