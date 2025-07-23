// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'

// // https://vite.dev/config/
// export default defineConfig({
//   plugins: [react()],
//   optimizeDeps: {
//     include: ['libsignal-protocol'],
//   },
// })

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Point directly to the ESM bundle inside the package
      'libsignal-protocol': path.resolve(
        __dirname,
        'node_modules/libsignal-protocol/dist/lib/index.js'
      )
    }
  }
});
