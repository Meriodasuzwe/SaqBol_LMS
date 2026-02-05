/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  // Подключаем плагин daisyui
  plugins: [require("daisyui")],
  
  // Настройка тем
  daisyui: {
    // Включаем светлую и темную темы
    themes: ["light", "dark"],
    // Указываем, какая тема считается "темной" по умолчанию
    darkTheme: "dark", 
  },
}