export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // 👈 這行超級重要！它告訴 Tailwind 去掃描 src 資料夾下所有的 jsx 檔案
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}