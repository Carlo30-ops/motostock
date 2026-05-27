import { defineConfig, mergeConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { defineConfig as defineVitestConfig } from 'vitest/config';

// https://vitejs.dev/config/
const viteConfig = defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'MotoStock',
        short_name: 'MotoStock',
        description: 'Sistema de Gestión de Taller y Repuestos',
        theme_color: '#0f4c75',
        icons: [
          {
            src: 'https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/wrench.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^http:\/\/localhost:8000\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 1 day
              },
              networkTimeoutSeconds: 5,
            }
          }
        ]
      }
    })
  ],
  server: {
    host: true, // Needed for Docker and local network access (tablet)
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/app'),
      '@shared': path.resolve(__dirname, './src/app/components'),
      '@modules': path.resolve(__dirname, './src/app/modules'),
      '@hooks': path.resolve(__dirname, './src/app/hooks'),
      '@api': path.resolve(__dirname, './src/app/api'),
      '@lib': path.resolve(__dirname, './src/app/lib'),
      '@types': path.resolve(__dirname, './src/app/types'),
      'react': 'react',
      'react-dom': 'react-dom'
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'lucide-react']
  }
});

const vitestConfig = defineVitestConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/app/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});

export default mergeConfig(viteConfig, vitestConfig);

