import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: { enabled: true },          // dev rejimda ham ishlaydi
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.js',
        injectRegister: false,                  // main.jsx da o'zimiz register qilamiz
        manifest: {
          name: 'Marjona Med Servis',
          short_name: 'MarjonaMed',
          description: 'Tibbiy klinika boshqaruv tizimi',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'any',
          background_color: '#09101f',
          theme_color: '#d4af37',
          lang: 'uz',
          icons: [
            {
              src: '/assets/logo.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/assets/logo.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/assets/logo.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          shortcuts: [
            {
              name: 'Yangi mijoz',
              short_name: 'Yangi',
              url: '/admin/new-patient',
              icons: [{ src: '/assets/logo.png', sizes: '96x96' }],
            },
          ],
          categories: ['medical', 'productivity', 'business'],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@assets': path.resolve(__dirname, '../assets'),
      },
    },
    server: {
      host: true,
      port: 5173,
      proxy: {
        // VITE_DEV_API_TARGET — faqat ishlab chiqish serveri uchun.
        // VITE_API_URL dan farqi: u brauzerga ham ta'sir qiladi va brauzer
        // backendga TO'G'RIDAN-TO'G'RI murojaat qiladi — natijada sahifa
        // 127.0.0.1:5173 orqali ochilsa CORS bloklab qo'yadi. Bu o'zgaruvchi
        // esa faqat proksi manzilini o'zgartiradi, brauzer baribir /api ga
        // murojaat qiladi va CORS umuman ishtirok etmaydi.
        '/api': {
          target: env.VITE_DEV_API_TARGET || env.VITE_API_URL || 'http://localhost:8000',
          changeOrigin: true,
        },
        '/uploads': {
          target: env.VITE_DEV_API_TARGET || env.VITE_API_URL || 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
  }
})
