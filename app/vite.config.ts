import { defineConfig } from "vite";
import { wasp } from "wasp/client/vite";

export default defineConfig({
  plugins: [wasp()],
  preview: {
    allowedHosts: ['host.docker.internal'],
    host: '0.0.0.0',
  },
  server: {
    open: false,
  },
});
