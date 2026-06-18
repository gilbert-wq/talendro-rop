import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Function form (rather than the object/array-of-package-names form)
        // matches on the resolved module path, which correctly catches
        // CommonJS-interop internal module IDs that don't exactly equal the
        // literal package name. The previous object-form config produced an
        // empty "vendor-xlsx" chunk because xlsx's CJS interop module IDs
        // didn't match the bare 'xlsx' string it was keying on, so xlsx's
        // actual code silently ended up in the main entry chunk instead.
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('react-router-dom') || id.includes('/react/') || id.includes('/react-dom/')) return 'vendor-react'
          if (id.includes('@radix-ui')) return 'vendor-ui'
          if (id.includes('@supabase')) return 'vendor-supabase'
          if (id.includes('@tanstack')) return 'vendor-query'
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts'
          if (id.includes('xlsx')) return 'vendor-xlsx'
          return undefined
        },
      },
    },
  },
})
