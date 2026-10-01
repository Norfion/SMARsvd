import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'

const URL_COMPARTILHADA = 'http://tb-23.smarapd.com.br:5173/'

function lerVersaoSistema(): string {
  const caminho = fileURLToPath(new URL('../Directory.Build.props', import.meta.url))
  const versao = /<Version>\s*([^<\s]+)\s*<\/Version>/.exec(readFileSync(caminho, 'utf-8'))?.[1]
  if (!versao) {
    throw new Error(`A versão do sistema não foi encontrada em ${caminho}.`)
  }
  return versao
}

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
  define: {
    __VERSAO_SISTEMA__: JSON.stringify(lerVersaoSistema()),
  },
  css: {
    preprocessorOptions: {
      scss: {
        // O Bootstrap 4 (mesma versão dos sistemas da empresa) ainda usa @import e funções globais do Sass
        quietDeps: true,
        silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function'],
      },
    },
  },
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