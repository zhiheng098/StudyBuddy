import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2400,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('pdfjs-dist')) return 'pdf'
          if (id.includes('mermaid') || id.includes('cytoscape') || id.includes('dagre')) return 'mermaid'
          if (id.includes('katex')) return 'katex'
          if (id.includes('react-markdown') || id.includes('remark') || id.includes('rehype') || id.includes('micromark') || id.includes('hast') || id.includes('unist')) return 'markdown'
          if (id.includes('d3-force')) return 'd3'
          if (id.includes('dexie')) return 'dexie'
          return undefined
        },
      },
    },
  },
  server: {
    port: 5273,
    host: '0.0.0.0',
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
})
