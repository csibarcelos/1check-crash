
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html", 
    "./src/**/*.{js,ts,jsx,tsx}", 
  ],
  theme: {
    extend: {
      colors: {
        // Cores de destaque diretamente mapeadas
        'accent-gold': 'var(--color-accent-gold)',
        'accent-blue-neon': 'var(--color-accent-blue-neon)',

        // Cores de texto
        'text-strong': 'var(--color-text-strong)',
        'text-default': 'var(--color-text-default)',
        'text-muted': 'var(--color-text-muted)',
        
        // Cores de Status
        'status-success': 'var(--color-status-success)',
        'status-error': 'var(--color-status-error)',
        'status-warning': 'var(--color-status-warning)',

        // Cores de Background e Superfície (App Interno)
        'bg-main': 'var(--color-bg-main)',
        'bg-surface': 'var(--color-bg-surface)', 
        'bg-surface-opaque': 'var(--color-bg-surface-opaque)', 
        'border-subtle': 'var(--color-border-subtle)',
        'border-interactive': 'var(--color-border-interactive)',

        // Cores primárias e secundárias para Tailwind (App Interno)
        primary: {
          DEFAULT: 'var(--color-accent-blue-neon)',
          light: 'var(--color-primary-light)',
          dark: 'var(--color-primary-dark)',
          'cta-text': 'var(--color-primary-cta-text)'
        },
        secondary: { 
          DEFAULT: 'var(--color-accent-gold)',
          light: 'var(--color-secondary-light)',
          dark: 'var(--color-secondary-dark)',
          'cta-text': 'var(--color-secondary-cta-text)'
        },
        neutral: {
          50: 'var(--color-neutral-50)',
          100: 'var(--color-neutral-100)',
          200: 'var(--color-neutral-200)',
          300: 'var(--color-neutral-300)',
          400: 'var(--color-neutral-400)',
          500: 'var(--color-neutral-500)', 
          600: 'var(--color-neutral-600)',
          700: 'var(--color-neutral-700)',
          800: 'var(--color-neutral-800)',
          900: 'var(--color-neutral-900)',
          950: 'var(--color-neutral-950)',
        },

        // Cores específicas para Auth Page Reimagined
        'auth-bg-main-start': 'var(--auth-bg-main-start)',
        'auth-bg-main-mid': 'var(--auth-bg-main-mid)',
        'auth-bg-main-end': 'var(--auth-bg-main-end)',
        'auth-card-bg': 'var(--auth-card-bg)',
        'auth-card-border': 'var(--auth-card-border)',
        'auth-input-bg': 'var(--auth-input-bg)',
        'auth-input-border': 'var(--auth-input-border)',
        'auth-input-focus-border': 'var(--auth-input-focus-border)',
        'auth-text-primary': 'var(--auth-text-primary)',
        'auth-text-secondary': 'var(--auth-text-secondary)',
        'auth-accent-gold': 'var(--auth-accent-gold)',
        'auth-accent-gold-darker': 'var(--auth-accent-gold-darker)',
        'auth-cta-text-dark': 'var(--auth-cta-text-dark)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
      },
      borderRadius: {
        'xl': '0.75rem', 
        '2xl': '1rem',    
        '3xl': '1.25rem', 
      },
      boxShadow: {
        'glow-blue-neon': '0 0 20px 0px var(--color-accent-blue-neon)', 
        'glow-gold': '0 0 20px 0px var(--color-accent-gold)', 
        'soft': '0 4px 10px -1px rgba(0,0,0,0.07), 0 2px 6px -2px rgba(0,0,0,0.05)', 
        'medium': '0 10px 20px -3px rgba(0,0,0,0.07), 0 4px 8px -4px rgba(0,0,0,0.05)',
        'hard': '0 20px 30px -5px rgba(0,0,0,0.1), 0 8px 15px -6px rgba(0,0,0,0.08)' 
      },
      backdropBlur: {
        'none': '0',
        'xs': '2px',
        'sm': '4px',
        'md': '8px',
        'lg': '12px', 
        'xl': '16px',
      },
      transitionTimingFunction: {
        'circ-in': 'cubic-bezier(0.55, 0, 1, 0.45)',
        'circ-out': 'cubic-bezier(0, 0.55, 0.45, 1)',
        'circ-in-out': 'cubic-bezier(0.85, 0, 0.15, 1)',
      },
      animation: {
        goldFloat: 'goldFloat 12s ease-in-out infinite',
        greenFloat: 'greenFloat 15s ease-in-out infinite alternate',
      },
      keyframes: {
        goldFloat: {
          '0%, 100%': { transform: 'scale(1) translate(0, 0) rotate(0deg)', opacity: '0.6' },
          '33%': { transform: 'scale(1.3) translate(40px, -30px) rotate(20deg)', opacity: '0.8' },
          '66%': { transform: 'scale(0.9) translate(-20px, 50px) rotate(-15deg)', opacity: '0.5'},
        },
        greenFloat: {
          '0%, 100%': { transform: 'scale(1) translate(0px, 0px) rotate(0deg)', opacity: '0.5' },
          '50%': { transform: 'scale(1.4) translate(-50px, 30px) rotate(25deg)', opacity: '0.7' },
        },
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
