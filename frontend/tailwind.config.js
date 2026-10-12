/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
          950: '#431407',
        },
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        dark: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#151e32',
          900: '#0b1329',
          950: '#060a17',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'clean': '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.02)',
        'clean-md': '0 4px 12px -2px rgba(0, 0, 0, 0.05), 0 2px 6px -2px rgba(0, 0, 0, 0.03)',
        'clean-lg': '0 12px 28px -6px rgba(0, 0, 0, 0.06), 0 6px 12px -4px rgba(0, 0, 0, 0.03)',
        'clean-xl': '0 20px 35px -10px rgba(0, 0, 0, 0.08), 0 10px 15px -5px rgba(0, 0, 0, 0.04)',
        'luminous': '0 0 0 1px rgba(0, 0, 0, 0.04), 0 2px 4px 0 rgba(0, 0, 0, 0.02), 0 12px 24px -4px rgba(0, 0, 0, 0.04)',
        'luminous-hover': '0 0 0 1px rgba(59, 130, 246, 0.15), 0 8px 30px -4px rgba(59, 130, 246, 0.12), 0 4px 12px -2px rgba(0, 0, 0, 0.04)',
      },
      backgroundImage: {
        'ogb-45': 'linear-gradient(45deg, #ef4444 0%, #6366f1 50%, #2563eb 100%)',
        'ogb-45-hover': 'linear-gradient(45deg, #dc2626 0%, #4f46e5 50%, #1d4ed8 100%)',
        'ogb-45-subtle': 'linear-gradient(45deg, rgba(239, 68, 68, 0.16) 0%, rgba(99, 102, 241, 0.12) 50%, rgba(37, 99, 235, 0.16) 100%)',
        'rb-45': 'linear-gradient(45deg, #ef4444 0%, #6366f1 50%, #2563eb 100%)',
        'rb-45-hover': 'linear-gradient(45deg, #dc2626 0%, #4f46e5 50%, #1d4ed8 100%)',
        'rb-45-subtle': 'linear-gradient(45deg, rgba(239, 68, 68, 0.16) 0%, rgba(99, 102, 241, 0.12) 50%, rgba(37, 99, 235, 0.16) 100%)',
      }
    },
  },
  plugins: [],
}

