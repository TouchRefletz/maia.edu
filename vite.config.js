import { defineConfig } from 'vite';

export default defineConfig({
  // Basic configuration
  build: {
    target: 'esnext',
  },
  envPrefix: ['VITE_', 'FIREBASE_', 'IMGBB_', 'GOOGLE_', 'PINECONE_'],
});
