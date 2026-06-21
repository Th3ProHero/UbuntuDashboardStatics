/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0f',
        panel: 'rgba(20, 20, 25, 0.6)',
        panelBorder: 'rgba(255, 255, 255, 0.08)',
        accent: '#3b82f6',
        accentHover: '#2563eb',
        danger: '#ef4444',
        success: '#10b981',
        warning: '#f59e0b',
        info: '#3b82f6',
      },
    },
  },
  plugins: [],
}
