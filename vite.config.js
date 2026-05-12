import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  server: {
    open: '/ghost-detectives.html',
    plugins: [],
  },
  plugins: [
    {
      name: 'redirect-root',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/') {
            res.writeHead(302, { Location: '/ghost-detectives.html' });
            res.end();
          } else {
            next();
          }
        });
      },
    },
  ],
  build: {
    rollupOptions: {
      input: 'ghost-detectives.html',
    },
  },
});
