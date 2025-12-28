const { loadEngineConfig } = require('./config/engineConfig');
const { EngineRunner } = require('./runner/engineRunner');

async function main() {
  const config = loadEngineConfig();
  const runner = new EngineRunner(config);
  await runner.start();

  const shutdown = async () => {
    await runner.stop();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Engine failed to start', err);
  process.exit(1);
});
