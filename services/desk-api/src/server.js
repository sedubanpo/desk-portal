import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createFirebaseDependencies } from './firebase.js';

const config = loadConfig();
const dependencies = createFirebaseDependencies(config);
const app = createApp({ config, ...dependencies });

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(JSON.stringify({
    severity: 'INFO',
    message: 'desk-portal-api listening',
    port: config.port,
    environment: config.environment
  }));
});

function shutdown(signal) {
  console.log(JSON.stringify({ severity: 'INFO', message: 'shutdown requested', signal }));
  server.close(error => {
    if (error) {
      console.error(JSON.stringify({ severity: 'ERROR', message: error.message }));
      process.exitCode = 1;
    }
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
