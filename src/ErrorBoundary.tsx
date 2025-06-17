
import React from 'react';
import { useRouteError, Link } from 'react-router-dom'; // Corrected import

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
  let message = "Ocorreu um erro inesperado.";

  if (error) {
    if (error.status === 404) {
      title = "Página Não Encontrada (404)";
      message = "A página que você está procurando não existe ou foi movida.";
    } else if (error.statusText) {
      message = error.statusText;
    } else if (error.message) {
      message = error.message;
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-900 text-neutral-100 p-6 text-center">
      <div className="bg-neutral-800 p-8 rounded-2xl shadow-xl border border-neutral-700">
        <h1 className="text-4xl font-bold text-red-500 mb-4">{title}</h1>
        <p className="text-lg text-neutral-300 mb-6">{message}</p>
        {error?.data && (
          <pre className="text-xs text-neutral-400 bg-neutral-700 p-3 rounded-md text-left overflow-auto max-h-60 mb-6">
            {typeof error.data === 'string' ? error.data : JSON.stringify(error.data, null, 2)}
          </pre>
        )}
        <Link
          to="/"
          className="px-6 py-3 bg-primary text-neutral-900 font-semibold rounded-xl hover:bg-primary-dark transition-colors duration-200"
        >
          Voltar para a Página Inicial
        </Link>
      </div>
    </div>
  );
};
