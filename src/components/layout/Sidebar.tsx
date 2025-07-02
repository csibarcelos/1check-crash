import React, { Fragment } from 'react';
import { NavLink, useNavigate } from "react-router-dom";
import { Dialog, Transition } from '@headlessui/react';
import { NAV_ITEMS, NAV_ITEMS_SUPER_ADMIN, LogoutIcon, XMarkIcon, cn } from '../../constants';
import { AppLogoIcon } from '../AppLogoIcon';
import AppLogoSvg from '@/assets/images/logo.svg?react'; // Importação do SVG para o modo compacto
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { NavItemConfig } from '../../types';

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  isCompact: boolean;
  toggleCompact: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ sidebarOpen, setSidebarOpen, isCompact, toggleCompact }) => {
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
      <div className={cn(
        "flex items-center justify-center h-24 border-b border-border-subtle px-4 shadow-md",
        isCompact ? 'px-2' : 'px-4'
      )}>
        <NavLink to={dashboardPath} className="flex items-center group p-2 rounded-xl hover:bg-white/5 transition-colors duration-300 ease-in-out transform hover:scale-105">
          {isCompact 
            ? <AppLogoSvg className="h-10 w-10 text-accent-gold group-hover:opacity-90 transition-opacity" />
            : <AppLogoIcon className="h-12 w-auto text-accent-gold group-hover:opacity-90 transition-opacity" />
          }
           {/* Removido o span de texto "1Checkout" */}
        </NavLink>
      </div>
      <nav className="mt-6 flex-1 px-3 space-y-1.5">
        {currentNavItems.map((item: NavItemConfig) => (
          <NavLink
            key={item.name}
            to={item.href}
            end={item.href === dashboardPath || item.href === '/dashboard'} 
            className={({ isActive }) =>
              cn(
                `group flex items-center px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ease-in-out relative transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-accent-blue-neon/50 focus:ring-offset-1 focus:ring-offset-bg-main`,
                isActive 
                  ? 'bg-accent-blue-neon/10 text-accent-blue-neon shadow-lg' 
                  : 'text-text-default hover:bg-white/5 hover:text-text-strong',
                item.soon ? 'opacity-60 cursor-not-allowed pointer-events-none' : '',
                isCompact && 'justify-center'
              )
            }
            onClick={(e) => {
              if (item.soon) e.preventDefault();
              if (sidebarOpen && window.innerWidth < 768) { 
                setSidebarOpen(false);
              }
            }}
            aria-disabled={item.soon}
            tabIndex={item.soon ? -1 : 0}
          >
            {({ isActive: iconIsActive }) => (
              <>
                {iconIsActive && !isCompact && <div className="absolute left-0 top-1/2 -translate-y-1/2 h-3/4 w-1 bg-accent-blue-neon rounded-r-md shadow-glow-blue-neon/30"></div>}
                <item.icon className={cn(
                  `flex-shrink-0 h-5 w-5 transition-colors duration-200`,
                  iconIsActive ? 'text-accent-blue-neon' : 'text-text-muted group-hover:text-text-default',
                  isCompact ? 'mx-auto' : 'mr-3 ml-0.5'
                )} aria-hidden="true" />
                {!isCompact && <span className="truncate">{item.name}</span>}
                {!isCompact && item.soon && <span className="ml-auto text-xs bg-neutral-400 text-bg-main px-1.5 py-0.5 rounded-full font-semibold">EM BREVE</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className={cn("mt-auto p-4 border-t border-border-subtle", isCompact && "p-2")}>
        <div 
          className={cn(
            "flex items-center mb-4 p-3 rounded-xl bg-white/5 cursor-pointer",
            isCompact ? "p-2 justify-center" : "",
            "transition-colors duration-200 hover:bg-white/10"
          )}
          onClick={toggleCompact}
        >
          <div className="h-10 w-10 rounded-full bg-accent-gold flex items-center justify-center text-bg-main font-bold text-lg shadow-sm">
            {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || '?'}
          </div>
          {!isCompact && (
            <div className="ml-3 overflow-hidden">
              <p className="text-sm font-semibold text-text-strong truncate font-display">{user?.name || 'Usuário'}</p>
              <p className="text-xs text-text-muted truncate">{user?.email}</p>
            </div>
          )}
        </div>
        <Button 
          variant="outline" 
          onClick={handleLogout} 
          className="w-full border-accent-blue-neon/60 text-accent-blue-neon hover:bg-accent-blue-neon/10 hover:border-accent-blue-neon hover:text-accent-blue-neon"
          leftIcon={isCompact ? undefined : <LogoutIcon className="h-5 w-5"/>}
          isFullWidth={true}
        >
          {isCompact ? <LogoutIcon className="h-5 w-5 mx-auto" /> : "Sair"}
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile sidebar */}
      <Transition.Root show={sidebarOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50 md:hidden app-dark-theme" onClose={setSidebarOpen}>
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
            <div className="w-14 flex-shrink-0" aria-hidden="true" /> {/* Dummy element to force sidebar to shrink to fit close icon */}
          </div>
        </Dialog>
      </Transition.Root>

      {/* Static sidebar for desktop */}
      <div className={cn(
        "hidden md:fixed md:inset-y-0 md:z-40 md:flex md:flex-col transition-all duration-300 ease-in-out",
        isCompact ? "w-24" : "w-72"
      )}>
        <div className="flex min-h-0 flex-1 flex-col bg-bg-main border-r border-border-subtle">
          {navigationContent}
        </div>
      </div>
    </>
  );
};