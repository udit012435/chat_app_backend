import http from 'http';
import { app } from './src/app.js';
import { connectDB } from './src/config/db.js';
import { initSockets } from './src/sockets/index.js';
import { env } from './src/config/env.js';

const start = async () => {
  await connectDB();

  const httpServer = http.createServer(app);
  const io = initSockets(httpServer);
  app.set('io', io);

  httpServer.listen(env.port, () => {
    console.log(`[server] Listening on http://localhost:${env.port}`);
  });
};

start().catch((err) => {
  console.error('[server] Failed to start:', err);
  process.exit(1);
});
