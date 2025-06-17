
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

        // Cores de Background e Superfície
        'bg-main': 'var(--color-bg-main)',
        'bg-surface': 'var(--color-bg-surface)', // Para glassmorphism ou cards não-glass
        'border-subtle': 'var(--color-border-subtle)',

        // Cores primárias e secundárias para Tailwind (usando as vars de acento)
        primary: {
          DEFAULT: 'var(--color-primary-DEFAULT)', // Azul Neon
          light: 'var(--color-primary-light)',
          dark: 'var(--color-primary-dark)',
        },
        secondary: { 
          DEFAULT: 'var(--color-secondary-DEFAULT)', // Dourado
          light: 'var(--color-secondary-light)',
          dark: 'var(--color-secondary-dark)',
        },
        // Neutrals para Tailwind (usando as vars de texto/bg)
        neutral: {
          50: 'var(--color-neutral-50)',
          100: 'var(--color-neutral-100)',
          200: 'var(--color-neutral-200)',
          300: 'var(--color-text-muted)', /* #6B7280 Muted text */
          400: 'var(--color-text-default)', /* #A1A1A1 Secondary text */
          500: '#C0C0C0', /* Cinza mais claro para contraste se necessário */
          600: 'var(--color-text-strong)', /* #FFFFFF Principal Text */
          700: 'var(--color-bg-surface)', /* Glass bg, or a slightly lighter dark for non-glass cards */
          800: 'var(--color-bg-main)', /* Main bg */
          900: '#0A0A0A', /* Deepest bg */
          950: '#050505',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem', // 16px (reafirmando ou customizando)
        '3xl': '1.5rem', // 24px (adicionando se não existir)
      },
      boxShadow: { // Para o glow sutil dos botões, por exemplo
        'glow-blue-neon': '0 0 15px 0px var(--color-accent-blue-neon)',
        'glow-gold': '0 0 15px 0px var(--color-accent-gold)',
      },
      backdropBlur: { // Garantindo que temos opções de blur se não padrão
        'xs': '2px',
        'sm': '4px',
        'md': '8px', // Usado nos cards
        'lg': '12px',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'), // Útil para estilização de formulários
  ],
}