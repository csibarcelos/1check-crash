import React from 'react';
import { AppLogoIcon } from '../constants.tsx';
import { Button } from '@/components/ui/Button';
import { ArrowRight } from 'lucide-react'; // Assuming lucide-react is available as per 1checklov

export const HomePage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bg-main text-text-default p-6 overflow-hidden">
      <header className="w-full max-w-6xl mx-auto py-6 flex justify-between items-center">
        <AppLogoIcon className="h-10" />
        <div className="space-x-3">
          <Button 
            variant="outline" 
            onClick={() => window.location.href = '/auth'}
            className="text-accent-blue-neon border-accent-blue-neon hover:bg-accent-blue-neon/10 hover:text-accent-blue-neon"
          >
            Login
          </Button>
          <Button 
            variant="primary"
            onClick={() => window.location.href = '/auth?register=true'}
            className="bg-accent-blue-neon text-black hover:bg-opacity-80"
          >
            Criar Conta Grátis
          </Button>
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center justify-center text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-accent-gold/10 border border-accent-gold/30 rounded-full px-4 py-2 text-sm font-medium text-accent-gold mb-6">
          <span>BETA EXCLUSIVO</span>
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-text-strong mb-6 leading-tight">
          A plataforma que <span className="text-accent-gold">revoluciona</span> suas vendas online
        </h1>
        <p className="text-lg md:text-xl text-text-default mb-10 max-w-2xl">
          Bem-vindo à 1Checkout. Esta é a página inicial. O conteúdo e design completos baseados na sua referência visual serão implementados aqui.
        </p>
        <Button 
            size="lg" 
            onClick={() => window.location.href = '/auth?register=true'}
            className="bg-accent-blue-neon text-black hover:bg-opacity-80 px-8 py-4 text-lg"
        >
            Começar Gratuitamente
            <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </main>
      <footer className="w-full max-w-6xl mx-auto py-8 text-center text-xs text-text-muted border-t border-border-subtle mt-12">
        <p>&copy; {new Date().getFullYear()} 1Checkout. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
};