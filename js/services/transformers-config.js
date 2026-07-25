import { env } from '@xenova/transformers';

// Disable local models to prevent 404s (HTML response) when fetch tries to find them locally
// This forces usage of the Hugging Face CDN
env.allowLocalModels = false;
env.useBrowserCache = false;

console.log('[Transformers Config] Local models disabled, using CDN.');
