import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

const isDev = process.env.NODE_ENV !== 'production'
const useLocalSsl = process.env.VITE_LOCAL_SSL === 'true'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    isDev && useLocalSsl ? basicSsl() : null,
  ],
  server: {
    host: true,
  },
})
