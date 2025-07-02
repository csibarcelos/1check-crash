import React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { useAuth } from '../../contexts/AuthContext'; 
import { useNavigate } from "react-router-dom"; 
import { CogIcon, LogoutIcon, Bars3IconHero, cn, UserCircleIcon } from '../../constants'; 

interface HeaderProps {
  setSidebarOpen: (open: boolean) => void;
  isSidebarCompact: boolean; // Adicionado
}

export const Header: React.FC<HeaderProps> = ({ setSidebarOpen, isSidebarCompact }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const userInitial = user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || '?';

  return (
    <header className={cn(
      "fixed top-0 right-0 z-30 transition-all duration-300 w-full",
      isSidebarCompact ? "md:left-24" : "md:left-72",
      "bg-bg-surface/50 backdrop-blur-lg shadow-lg flex-shrink-0 border-b border-border-subtle"
    )}>
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-24"> 
          <div className="flex items-center md:hidden">
            <button
              type="button"
              className="p-2 rounded-xl text-text-muted hover:text-text-strong hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent-blue-neon transition-colors duration-150"
              onClick={() => setSidebarOpen(true)}
            >
              <span className="sr-only">Abrir sidebar</span>
              <Bars3IconHero className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
          <div className="flex-1"></div> 
          <div className="ml-auto flex items-center">
            <DropdownMenuPrimitive.Root>
              <DropdownMenuPrimitive.Trigger asChild>
                <button className="max-w-xs bg-transparent flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-surface focus:ring-accent-blue-neon">
                  <span className="sr-only">Abrir menu do usuário</span>
                  <div className="h-10 w-10 rounded-full bg-accent-gold flex items-center justify-center text-bg-main font-bold text-lg shadow-md">
                    {userInitial}
                  </div>
                </button>
              </DropdownMenuPrimitive.Trigger>
              <DropdownMenuPrimitive.Portal>
                <DropdownMenuPrimitive.Content
                  sideOffset={5}
                  align="end"
                  className={cn(
                    "z-50 w-64 origin-top-right overflow-hidden rounded-2xl border border-border-subtle bg-bg-surface bg-opacity-70 backdrop-blur-lg p-2 shadow-2xl",
                    "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
                    "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
                    "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2"
                  )}
                >
                  <DropdownMenuPrimitive.Label asChild>
                    <div className="px-3 py-2.5 text-xs text-text-muted border-b border-border-subtle mb-1.5">
                      Logado como
                      <p className="text-sm font-medium text-text-strong truncate font-display">{user?.name || user?.email}</p>
                    </div>
                  </DropdownMenuPrimitive.Label>
                  
                  <DropdownMenuPrimitive.Item asChild onSelect={() => navigate('/minha-conta')} > 
                    <div className={cn(
                        "group relative flex cursor-default select-none items-center rounded-lg px-3 py-2.5 text-sm text-text-default outline-none transition-colors",
                        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-white/10 data-[highlighted]:text-accent-blue-neon"
                    )}>
                      <UserCircleIcon className="mr-3 h-5 w-5 text-text-muted group-data-[highlighted]:text-accent-blue-neon" aria-hidden="true" />
                      Minha Conta
                    </div>
                  </DropdownMenuPrimitive.Item>

                  <DropdownMenuPrimitive.Item asChild onSelect={() => navigate('/configuracoes')}>
                    <div className={cn(
                        "group relative flex cursor-default select-none items-center rounded-lg px-3 py-2.5 text-sm text-text-default outline-none transition-colors",
                        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-white/10 data-[highlighted]:text-accent-blue-neon"
                    )}>
                      <CogIcon className="mr-3 h-5 w-5 text-text-muted group-data-[highlighted]:text-accent-blue-neon" aria-hidden="true" />
                      Configurações da Plataforma
                    </div>
                  </DropdownMenuPrimitive.Item>
                  <DropdownMenuPrimitive.Item asChild onSelect={handleLogout}>
                    <div className={cn(
                        "group relative flex cursor-default select-none items-center rounded-lg px-3 py-2.5 text-sm text-text-default outline-none transition-colors",
                        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-white/10 data-[highlighted]:text-accent-blue-neon"
                    )}>
                      <LogoutIcon className="mr-3 h-5 w-5 text-text-muted group-data-[highlighted]:text-accent-blue-neon" aria-hidden="true" />
                      Sair
                    </div>
                  </DropdownMenuPrimitive.Item>
                </DropdownMenuPrimitive.Content>
              </DropdownMenuPrimitive.Portal>
            </DropdownMenuPrimitive.Root>
          </div>
        </div>
      </div>
    </header>
  );
};