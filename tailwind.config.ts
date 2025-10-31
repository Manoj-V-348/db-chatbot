import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Base colors
        ink: {
          DEFAULT: '#05060b',
          50: '#f8f9fa',
          100: '#e9ecef',
          200: '#dee2e6',
          300: '#ced4da',
          400: '#adb5bd',
          500: '#6c757d',
          600: '#495057',
          700: '#343a40',
          800: '#212529',
          900: '#0b0d10',
          950: '#05060b',
        },

        // Brand accent colors
        accent: {
          DEFAULT: '#0a84ff',
          50: '#e6f4ff',
          100: '#bae7ff',
          200: '#91d5ff',
          300: '#69c0ff',
          400: '#40a9ff',
          500: '#0a84ff',
          600: '#096dd9',
          700: '#0050b3',
          800: '#003a8c',
          900: '#002766',
        },

        // Secondary accent
        'accent-soft': '#5ac8fa',

        // Surface colors with alpha
        surface: {
          glass: 'rgba(13, 17, 23, 0.65)',
          'glass-soft': 'rgba(15, 22, 35, 0.45)',
          'glass-bright': 'rgba(25, 35, 50, 0.75)',
          elevated: 'rgba(15, 22, 35, 0.85)',
        },

        // Semantic colors for enterprise
        success: {
          DEFAULT: '#34c759',
          light: '#52d97a',
          dark: '#2da84e',
        },
        warning: {
          DEFAULT: '#ff9500',
          light: '#ffaa33',
          dark: '#cc7700',
        },
        error: {
          DEFAULT: '#ff3b30',
          light: '#ff6259',
          dark: '#cc2f26',
        },
        info: {
          DEFAULT: '#5ac8fa',
          light: '#7dd4fb',
          dark: '#48a0c8',
        },
      },

      fontFamily: {
        sans: [
          '"Inter"',
          '"SF Pro Display"',
          '"SF Pro Text"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'system-ui',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          '"Fira Code"',
          '"Consolas"',
          '"Monaco"',
          'monospace',
        ],
      },

      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.05em' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0.01em' }],
        'base': ['1rem', { lineHeight: '1.5rem', letterSpacing: '0' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],
        'xl': ['1.25rem', { lineHeight: '1.875rem', letterSpacing: '-0.01em' }],
        '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.02em' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.02em' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.02em' }],
        '5xl': ['3rem', { lineHeight: '1', letterSpacing: '-0.02em' }],
      },

      boxShadow: {
        // Elevation shadows
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'DEFAULT': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',

        // Custom enterprise shadows
        elevation: '0 40px 80px -30px rgba(8, 13, 26, 0.65)',
        'elevation-soft': '0 20px 50px -30px rgba(8, 13, 26, 0.45)',
        'elevation-xs': '0 8px 20px -10px rgba(8, 13, 26, 0.35)',
        pill: '0 18px 38px -18px rgba(10, 132, 255, 0.45)',
        'pill-soft': '0 12px 24px -12px rgba(10, 132, 255, 0.25)',
        glow: '0 0 60px -15px rgba(10, 132, 255, 0.5)',
        'glow-sm': '0 0 30px -10px rgba(10, 132, 255, 0.3)',

        // Inner shadows
        'inner-sm': 'inset 0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'inner': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
      },

      backgroundImage: {
        // Gradient backgrounds
        aurora:
          'radial-gradient(110% 110% at 15% 15%, rgba(10, 132, 255, 0.25), transparent 60%), radial-gradient(140% 140% at 85% 20%, rgba(94, 92, 230, 0.35), transparent 55%), radial-gradient(160% 160% at 50% 95%, rgba(52, 199, 89, 0.3), transparent 60%)',
        mesh:
          'radial-gradient(circle at 20% 20%, rgba(10, 132, 255, 0.12), transparent 40%), radial-gradient(circle at 80% 0%, rgba(94, 92, 230, 0.18), transparent 45%), radial-gradient(circle at 50% 95%, rgba(52, 199, 89, 0.15), transparent 55%)',
        grid:
          'linear-gradient(to right, rgba(255, 255, 255, 0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',

        // Accent gradients
        'gradient-primary': 'linear-gradient(135deg, #0a84ff 0%, #5ac8fa 100%)',
        'gradient-success': 'linear-gradient(135deg, #34c759 0%, #52d97a 100%)',
        'gradient-warning': 'linear-gradient(135deg, #ff9500 0%, #ffaa33 100%)',
        'gradient-error': 'linear-gradient(135deg, #ff3b30 0%, #ff6259 100%)',
      },

      backdropBlur: {
        xs: '4px',
        sm: '8px',
        DEFAULT: '12px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        diamond: '28px',
      },

      transitionTimingFunction: {
        gentle: 'cubic-bezier(0.22, 1, 0.36, 1)',
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
        bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },

      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'fade-out': 'fadeOut 0.3s ease-in-out',
        'slide-in-up': 'slideInUp 0.4s ease-out',
        'slide-in-down': 'slideInDown 0.4s ease-out',
        'slide-in-left': 'slideInLeft 0.4s ease-out',
        'slide-in-right': 'slideInRight 0.4s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideInUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInDown: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },

      borderRadius: {
        'sm': '0.375rem',
        'DEFAULT': '0.5rem',
        'md': '0.75rem',
        'lg': '1rem',
        'xl': '1.5rem',
        '2xl': '2rem',
        '3xl': '3rem',
      },
    },
  },
  plugins: [],
};

export default config;

