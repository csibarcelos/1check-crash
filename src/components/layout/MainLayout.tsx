import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar'; 
import { Header } from './Header'; 
import { motion } from "framer-motion";
import { useLocation } from "react-router-dom";
import { cn } from '../../constants';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MotionMain = motion.main as any;

const mainVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3, ease: "circOut" as const } },
  exit: { opacity: 0, transition: { duration: 0.2, ease: "circIn" as const } }
};

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCompact, setIsSidebarCompact] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const savedState = localStorage.getItem('sidebarCompact');
    if (savedState) {
      setIsSidebarCompact(JSON.parse(savedState));
    }
  }, []);

  const toggleSidebarCompact = () => {
    setIsSidebarCompact(prevState => {
      const newState = !prevState;
      localStorage.setItem('sidebarCompact', JSON.stringify(newState));
      return newState;
    });
  };

  return (
    <div className="flex h-screen app-dark-theme bg-bg-main">
      <Sidebar 
        sidebarOpen={sidebarOpen} 
        setSidebarOpen={setSidebarOpen} 
        isCompact={isSidebarCompact} 
        toggleCompact={toggleSidebarCompact} 
      />
      <div className={cn(
        "relative flex flex-col flex-1 transition-all duration-300 ease-in-out",
        isSidebarCompact ? "md:pl-24" : "md:pl-72"
      )}>
        <Header setSidebarOpen={setSidebarOpen} isSidebarCompact={isSidebarCompact} />
        <MotionMain 
          key={location.pathname} 
          variants={mainVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="flex-1 overflow-x-hidden overflow-y-auto bg-bg-main px-6 md:px-8 pb-8 pt-32"
        > 
          <div className="max-w-7xl mx-auto"> 
            {children}
          </div>
        </MotionMain>
      </div>
    </div>
  );
};