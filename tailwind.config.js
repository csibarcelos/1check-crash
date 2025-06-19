
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html", 
    "./src/**/*.{js,ts,jsx,tsx}", 
  ],
  theme: {
    extend: {
      colors: {
        'bg-main': 'var(--color-bg-main)',
        'bg-surface': 'var(--color-bg-surface)',
        'border-subtle': 'var(--color-border-subtle)',
        
        'accent-blue-neon': 'var(--color-accent-blue-neon)',
        'accent-gold': 'var(--color-accent-gold)',

        'text-strong': 'var(--color-text-strong)',
        'text-default': 'var(--color-text-default)',
        'text-muted': 'var(--color-text-muted)',
        
        'status-success': 'var(--color-status-success)',
        'status-error': 'var(--color-status-error)',
        'status-warning': 'var(--color-status-warning)',

        primary: { // Mapeia para accent-blue-neon
          DEFAULT: 'var(--color-primary-DEFAULT)',
          light: 'var(--color-primary-light)',
          dark: 'var(--color-primary-dark)',
        },
        secondary: { // Mapeia para accent-gold
          DEFAULT: 'var(--color-secondary-DEFAULT)',
          light: 'var(--color-secondary-light)',
          dark: 'var(--color-secondary-dark)',
        },
        neutral: { // Usando as variáveis CSS para consistência
          50: 'var(--color-neutral-50)',
          100: 'var(--color-neutral-100)',
          200: 'var(--color-neutral-200)',
          300: 'var(--color-neutral-300)', // text-muted
          400: 'var(--color-neutral-400)', // text-default
          500: 'var(--color-neutral-500)', // cinza claro para contraste
          600: 'var(--color-neutral-600)', // text-strong
          700: 'var(--color-neutral-700)', // Um cinza escuro para hover
          800: 'var(--color-neutral-800)', // bg-main
          900: 'var(--color-neutral-900)',
          950: 'var(--color-neutral-950)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Plus Jakarta Sans', 'sans-serif'], // Inter como primária para corpo
        heading: ['Plus Jakarta Sans', 'Inter', 'sans-serif'], // Plus Jakarta Sans para títulos
      },
      borderRadius: {
        'xl': '12px', // Novo padrão para botões e inputs
        '2xl': '16px', // Novo padrão para cards e modais
        // '3xl' já estava, pode manter ou remover se não usar mais.
      },
      boxShadow: {
        'glow-blue-neon': '0 0 15px 0px var(--color-accent-blue-neon)',
        'glow-gold': '0 0 15px 0px var(--color-accent-gold)',
        // Manter shadow-2xl como está ou ajustar se necessário. O script pede shadow-2xl para cards.
      },
      backdropBlur: {
        'xs': '2px',
        'sm': '4px',
        'md': '8px', // Usado nos cards e header
        'lg': '12px',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
