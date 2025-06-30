
import React from 'react';
import { useRouteError } from 'react-router-dom'; 
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AppLogoIcon } from './constants'; 

interface RouterError {
  statusText?: string;
  message?: string;
  status?: number;
  data?: any;
}

export const ErrorBoundary: React.FC = () => {
  const error = useRouteError() as RouterError;
  console.error("Router Error Boundary caught an error:", error);

  let title = "Oops! Algo deu errado.";
  let message = "Ocorreu um erro inesperado em nossa plataforma.";

  if (error) {
    if (error.status === 404) {
      title = "Página Não Encontrada (404)";
      message = "A página que você está procurando não existe ou foi movida. Verifique o endereço e tente novamente.";
    } else if (error.statusText) {
      message = error.statusText;
    } else if (error.message && !error.message.includes('Failed to fetch dynamically imported module')) { // Filter out vague import errors
      message = error.message;
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bg-main text-text-default p-6 text-center app-dark-theme">
       <AppLogoIcon className="h-20 w-auto mb-8 text-accent-gold" />
      <Card title={title} className="max-w-lg w-full shadow-2xl border-status-error/30">
        <div className="text-center">
          <p className="text-lg text-text-default mb-6">{message}</p>
          {error?.data && typeof error.data === 'string' && (
            <pre className="text-xs text-text-muted bg-bg-main p-3 rounded-md text-left overflow-auto max-h-60 mb-6 border border-border-subtle">
              {error.data}
            </pre>
          )}
          {error?.data && typeof error.data === 'object' && (
             <pre className="text-xs text-text-muted bg-bg-main p-3 rounded-md text-left overflow-auto max-h-60 mb-6 border border-border-subtle">
              {JSON.stringify(error.data, null, 2)}
            </pre>
          )}
          
          <div className="mt-8">
            <Button 
              to="/" 
              variant="primary" 
              size="lg"
              className="bg-accent-blue-neon text-bg-main hover:bg-opacity-90 focus:ring-accent-blue-neon"
            >
              Voltar para a Página Inicial
            </Button>
          </div>
        </div>
      </Card>
       <p className="mt-8 text-xs text-text-muted">
        Se o problema persistir, por favor, contate o suporte.
      </p>
    </div>
  );
};