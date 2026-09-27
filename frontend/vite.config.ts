import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const URL_COMPARTILHADA = 'http://tb-23.smarapd.com.br:5173/'

function mostrarUrlCompartilhada(): Plugin {
  return {
    name: 'mostrar-url-compartilhada',
    apply: 'serve',
    configureServer(server) {
      const printUrls = server.printUrls
      server.printUrls = () => {
        printUrls()
        server.config.logger.info(`  ➜  VPN:     ${URL_COMPARTILHADA}`)
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), mostrarUrlCompartilhada()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: ['tb-23.smarapd.com.br'],
    proxy: {
      '/api': 'http://localhost:5224',
    },
  },
})