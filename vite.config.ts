import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import svgr from 'vite-plugin-svgr';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    svgr(), // Use a configuração padrão do svgr
  ],
  resolve: {
    alias: {
      '@': path.resolve(path.dirname(fileURLToPath(import.meta.url)), './src'),
    },
  },
  // --- CORREÇÃO APLICADA AQUI ---
  server: {
    host: true, // Permite que o servidor seja acessível pela rede
    hmr: {
      host: 'localhost',
      protocol: 'ws',
    },
    // Adicionamos a lista de hosts permitidos
    allowedHosts: [
      'fc87-187-183-243-195.ngrok-free.app'
    ],
  },
});
