import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

// Standalone development UI; NEVER redirects marketplace/API calls to production.
// API integration is added after design approval and end-to-end search testing.
export default defineConfig({
  plugins:[react()],
  server:{host:'0.0.0.0',port:3000,strictPort:true}
});
