/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        signal: {
          high: '#22c55e',
          medium: '#eab308',
          low: '#ef4444',
        },
        // Token-driven grays — rgb triplets defined in index.css under :root
        // (dark) and .light, so text-dark-* / bg-dark-* flip with the theme.
        dark: {
          100: 'rgb(var(--c-100) / <alpha-value>)',
          200: 'rgb(var(--c-200) / <alpha-value>)',
          300: 'rgb(var(--c-300) / <alpha-value>)',
          400: 'rgb(var(--c-400) / <alpha-value>)',
          500: 'rgb(var(--c-500) / <alpha-value>)',
          600: 'rgb(var(--c-600) / <alpha-value>)',
          700: 'rgb(var(--c-700) / <alpha-value>)',
          800: 'rgb(var(--c-800) / <alpha-value>)',
          900: 'rgb(var(--c-900) / <alpha-value>)',
        },
        // Accent scales used for text/chips/bars — the 300/400/500 shades flip
        // per theme (deeper in light mode for contrast). Other shades stay as
        // Tailwind defaults via deep-merge.
        emerald: {
          300: 'rgb(var(--em-300) / <alpha-value>)',
          400: 'rgb(var(--em-400) / <alpha-value>)',
          500: 'rgb(var(--em-500) / <alpha-value>)',
        },
        amber: {
          300: 'rgb(var(--am-300) / <alpha-value>)',
          400: 'rgb(var(--am-400) / <alpha-value>)',
          500: 'rgb(var(--am-500) / <alpha-value>)',
        },
        sky: {
          300: 'rgb(var(--sk-300) / <alpha-value>)',
          400: 'rgb(var(--sk-400) / <alpha-value>)',
          500: 'rgb(var(--sk-500) / <alpha-value>)',
        },
        violet: {
          300: 'rgb(var(--vi-300) / <alpha-value>)',
          400: 'rgb(var(--vi-400) / <alpha-value>)',
          500: 'rgb(var(--vi-500) / <alpha-value>)',
        },
        red: {
          300: 'rgb(var(--rd-300) / <alpha-value>)',
          400: 'rgb(var(--rd-400) / <alpha-value>)',
          500: 'rgb(var(--rd-500) / <alpha-value>)',
        },
        cyan: {
          300: 'rgb(var(--cy-300) / <alpha-value>)',
          400: 'rgb(var(--cy-400) / <alpha-value>)',
          500: 'rgb(var(--cy-500) / <alpha-value>)',
        },
        teal: {
          300: 'rgb(var(--te-300) / <alpha-value>)',
          400: 'rgb(var(--te-400) / <alpha-value>)',
          500: 'rgb(var(--te-500) / <alpha-value>)',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
