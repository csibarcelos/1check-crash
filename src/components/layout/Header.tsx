
import React, { Fragment } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { useAuth } from '@/contexts/AuthContext'; 
import { useNavigate } from "react-router-dom"; 
import { CogIcon, LogoutIcon, Bars3IconHero } from '@/constants.tsx'; 

interface HeaderProps {
  setSidebarOpen: (open: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({ setSidebarOpen }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const userInitial = user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || '?';

  return (
    <header className="relative bg-bg-surface backdrop-blur-md shadow-lg flex-shrink-0 border-b border-border-subtle z-30">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20"> 
          <div className="flex items-center">
            <button
              type="button"
              className="p-2 rounded-xl text-text-muted hover:text-text-strong hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent-blue-neon md:hidden transition-colors duration-150"
              onClick={() => setSidebarOpen(true)}
            >
              <span className="sr-only">Abrir sidebar</span>
              <Bars3IconHero className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
          <div className="ml-auto flex items-center">
            <Menu as="div" className="ml-3 relative">
              <div>
                <Menu.Button className="max-w-xs bg-transparent flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-surface focus:ring-accent-blue-neon">
                  <span className="sr-only">Abrir menu do usuário</span>
                  <div className="h-10 w-10 rounded-full bg-accent-gold flex items-center justify-center text-black font-semibold text-lg">
                    {userInitial}
                  </div>
                </Menu.Button>
              </div>
              <Transition
                as={Fragment}
                enter="transition ease-out duration-200"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-100"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Menu.Items className="origin-top-right absolute right-0 mt-2 w-60 rounded-2xl shadow-2xl py-2 bg-bg-surface border border-border-subtle backdrop-blur-lg focus:outline-none z-40">
                  <div className="px-4 py-3 border-b border-border-subtle">
                    <p className="text-sm text-text-muted">Logado como</p>
                    <p className="text-sm font-medium text-text-strong truncate">{user?.name || user?.email}</p>
                  </div>
                  <div className="py-1">
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={() => navigate('/configuracoes')}
                          className={`${active ? 'bg-white/5 text-accent-blue-neon' : 'text-text-default'} group flex w-full items-center rounded-lg px-4 py-2.5 text-sm transition-colors duration-150`}
                        >
                          <CogIcon className="mr-3 h-5 w-5 text-text-muted group-hover:text-text-default" aria-hidden="true" />
                          Configurações
                        </button>
                      )}
                    </Menu.Item>
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={handleLogout}
                          className={`${active ? 'bg-white/5 text-accent-blue-neon' : 'text-text-default'} group flex w-full items-center rounded-lg px-4 py-2.5 text-sm transition-colors duration-150`}
                        >
                          <LogoutIcon className="mr-3 h-5 w-5 text-text-muted group-hover:text-text-default" aria-hidden="true" />
                          Sair
                        </button>
                      )}
                    </Menu.Item>
                  </div>
                </Menu.Items>
              </Transition>
            </Menu>
          </div>
        </div>
      </div>
    </header>
  );
};
