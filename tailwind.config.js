/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: '#0A0D12',
        slatepanel: '#11161F',
        steel: '#18202C',
        hairline: '#232E3F',
        alabaster: '#F1F5F9',
        techslate: '#94A3B8',
        osccyan: '#06B6D4',
        safegreen: '#10B981',
        sigamber: '#F59E0B',
        forensicred: '#EF4444',
      },
      fontFamily: {
        sans: ['"Space Grotesk"', '"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
