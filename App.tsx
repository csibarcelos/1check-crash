
import React, { useEffect, useRef } from 'react';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import '@/global.css';
import { router } from '@/router';

const App: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const playSound = () => {
      if (audioRef.current) {
        audioRef.current.currentTime = 0; // Reinicia o som caso seja tocado em rápida sucessão
        audioRef.current.play().catch(error => {
          // Navegadores modernos podem bloquear a reprodução automática de áudio.
          // O usuário pode precisar interagir com a página primeiro.
          console.warn("Audio playback failed. User interaction might be required.", error);
        });
      }
    };

    window.addEventListener('playSaleSound', playSound);

    return () => {
      window.removeEventListener('playSaleSound', playSound);
    };
  }, []);
  
  return (
    <AuthProvider>
      <RouterProvider router={router} />
      {/* Toaster from 'sonner' removed, as it's now handled globally by the custom ToastProvider */}
      {/* Elemento de áudio para o som de venda aprovada */}
      <audio 
        ref={audioRef} 
        src="https://cdn.pixabay.com/download/audio/2022/03/10/audio_c898c7b221.mp3?filename=cash-register-sound-effect-155856.mp3" 
        preload="auto" 
        className="hidden"
      ></audio>
    </AuthProvider>
  );
};

export default App;
