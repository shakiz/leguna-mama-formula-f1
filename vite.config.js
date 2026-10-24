import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works on Cloudflare Pages, GitHub Pages or itch.io alike
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      // Separate chunk for Phaser: it rarely changes, so browsers keep it cached across game updates
      output: { manualChunks: (id) => (id.includes('node_modules/phaser') ? 'phaser' : undefined) },
    },
  },
});
