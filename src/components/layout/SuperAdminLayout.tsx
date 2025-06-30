

import React from 'react';
import { Sidebar } from './Sidebar'; 
import { Header } from './Header'; 
import { motion } from "framer-motion";
import { useLocation } from "react-router-dom"; // Importado useLocation

interface SuperAdminLayoutProps {
  children: React.ReactNode;
}

const MotionMain = motion.main as any;

const mainVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3, ease: "circOut" as const } },
  exit: { opacity: 0, transition: { duration: 0.2, ease: "circIn" as const } }
};

export const SuperAdminLayout: React.FC<SuperAdminLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const location = useLocation(); // Usar useLocation

  return (
    <div className="flex h-screen app-dark-theme">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header setSidebarOpen={setSidebarOpen} />
        <MotionMain 
          key={location.pathname} // Chave alterada para location.pathname
          variants={mainVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="flex-1 overflow-x-hidden overflow-y-auto bg-bg-main p-6 md:p-8" // Ajustado padding
        >
           <div className="max-w-7xl mx-auto"> {/* Container para limitar largura */}
            {children}
          </div>
        </MotionMain>
      </div>
    </div>
  );
};