// ============================================================
// SERVER ENTRY POINT
// ============================================================

const app = require('./app');
const env = require('./config/env');
const prisma = require('./config/prisma');

const server = app.listen(env.port, () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🚀 Election Surveillance API running`);
  console.log(`   Port:        ${env.port}`);
  console.log(`   Environment: ${env.nodeEnv}`);
  console.log(`   URL:         http://localhost:${env.port}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

// ---- Graceful shutdown ----
async function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    console.log('✅ Server closed. Database disconnected.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ---- Catch unhandled errors ----
process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  process.exit(1);
});
