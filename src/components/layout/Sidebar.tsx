
import React, { Fragment } from 'react';
import { NavLink, useNavigate } from "react-router-dom"; 
import { Dialog, Transition } from '@headlessui/react';
import { NAV_ITEMS, NAV_ITEMS_SUPER_ADMIN, AppLogoIcon, LogoutIcon, XMarkIcon, AdjustmentsHorizontalIconReact, ShieldCheckIconReact, UserGroupIcon, BanknotesIconReact, TableCellsIconReact, ChartPieIcon } from '../../constants.tsx'; 
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { NavItemConfig } from '@/types';

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ sidebarOpen, setSidebarOpen }) => {
  const { user, logout, isSuperAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const currentNavItems = isSuperAdmin ? NAV_ITEMS_SUPER_ADMIN : NAV_ITEMS;
  
  const dashboardPath = isSuperAdmin ? "/superadmin/dashboard" : "/dashboard";

  const navigationContent = (
    <>
      <div className="flex items-center justify-center h-24 border-b border-border-subtle px-4">
        <NavLink to={dashboardPath} className="flex items-center group p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors duration-300 ease-in-out">
          <AppLogoIcon className="h-10 w-auto group-hover:opacity-90 transition-opacity" />
        </NavLink>
      </div>
      <nav className="mt-6 flex-1 px-3 space-y-2">
        {currentNavItems.map((item: NavItemConfig) => (
          <NavLink
            key={item.name}
            to={item.href}
            end={item.href === dashboardPath || item.href === '/dashboard'} 
            className={({ isActive }) =>
              `group flex items-center px-4 py-3 text-base font-medium rounded-xl transition-all duration-300 ease-in-out relative transform hover:scale-[1.02]
              ${isActive 
                ? 'bg-white/10 text-accent-blue-neon shadow-lg' 
                : 'text-text-default hover:bg-white/5 hover:text-text-strong'}
              ${item.soon ? 'opacity-50 cursor-not-allowed' : ''}`
            }
            onClick={(e) => {
              if (item.soon) e.preventDefault();
              if (sidebarOpen && window.innerWidth < 768) { 
                setSidebarOpen(false);
              }
            }}
          >
            {({ isActive: iconIsActive }) => (
              <>
                {iconIsActive && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-accent-blue-neon rounded-r-md shadow-glow-blue-neon/50"></div>}
                <item.icon className={`mr-3 ml-1 flex-shrink-0 h-6 w-6 transition-colors duration-300 ${iconIsActive ? 'text-accent-blue-neon' : 'text-text-muted group-hover:text-text-default'}`} aria-hidden="true" />
                <span className="truncate">{item.name}</span>
                {item.soon && <span className="ml-auto text-xs bg-neutral-700 text-text-muted px-2 py-0.5 rounded-full">EM BREVE</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto p-4 border-t border-border-subtle">
        <div className="flex items-center mb-4 p-3 rounded-xl bg-white/5">
          <div className="h-10 w-10 rounded-full bg-accent-gold flex items-center justify-center text-black font-semibold text-lg">
            {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || '?'}
          </div>
          <div className="ml-3 overflow-hidden">
            <p className="text-sm font-semibold text-text-strong truncate">{user?.name || 'Usuário'}</p>
            <p className="text-xs text-text-muted truncate">{user?.email}</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          onClick={handleLogout} 
          className="w-full border-accent-blue-neon/50 text-accent-blue-neon hover:bg-accent-blue-neon/10 hover:border-accent-blue-neon"
          leftIcon={<LogoutIcon className="h-5 w-5"/>}
        >
          Sair
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile sidebar */}
      <Transition.Root show={sidebarOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50 md:hidden" onClose={setSidebarOpen}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-bg-main/80 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative flex w-full max-w-xs flex-1 flex-col bg-bg-main border-r border-border-subtle">
                <Transition.Child
                  as={Fragment}
                  enter="ease-in-out duration-300"
                  enterFrom="opacity-0"
                  enterTo="opacity-100"
                  leave="ease-in-out duration-300"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <div className="absolute top-0 right-0 -mr-12 pt-2">
                    <button
                      type="button"
                      className="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-text-strong"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <span className="sr-only">Fechar sidebar</span>
                      <XMarkIcon className="h-6 w-6 text-text-strong" aria-hidden="true" />
                    </button>
                  </div>
                </Transition.Child>
                {navigationContent}
              </Dialog.Panel>
            </Transition.Child>
            <div className="w-14 flex-shrink-0" aria-hidden="true" />
          </div>
        </Dialog>
      </Transition.Root>

      {/* Static sidebar for desktop */}
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-72 bg-bg-main border-r border-border-subtle">
          {navigationContent}
        </div>
      </div>
    </>
  );
};