export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#000000',
          secondary: '#ffffff',
          accent: '#3b82f6', // Add your brand color
        }
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}