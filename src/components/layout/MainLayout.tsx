
import React from 'react';
import { Sidebar } from '@/components/layout/Sidebar'; 
import { Header } from '@/components/layout/Header'; 

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  return (
    <div className="flex h-screen bg-bg-main"> 
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-bg-main p-6 md:p-8 lg:p-12"> {/* Padding xl: 48px -> p-12 */}
          {children}
        </main>
      </div>
    </div>
  );
};
