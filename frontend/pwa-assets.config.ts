import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    apple: {
      sizes: [180],
      padding: 0,
      resizeOptions: {
        fit: 'contain',
        background: { r: 11, g: 12, b: 14, alpha: 1 }, // #0B0C0E
      },
    },
  },
  images: ['public/favicon.svg'],
});
