const { spawn } = require('child_process');
const fs = require('fs');

const LOG_FILE = '/home/z/my-project/dev.log';
const PID_FILE = '/tmp/next-server.pid';
const MAX_RESTARTS = 10;
const RESTART_DELAY = 3000; // 3 seconds between restarts

let restartCount = 0;
let lastRestartTime = 0;

function startServer() {
  // Clear old log
  fs.writeFileSync(LOG_FILE, '');
  
  const child = spawn('node', [
    '--max-old-space-size=1024',
    'node_modules/.bin/next',
    'dev',
    '-p', '3000',
    '-H', '0.0.0.0'
  ], {
    cwd: '/home/z/my-project',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  fs.writeFileSync(PID_FILE, child.pid.toString());
  console.log(`[watchdog] Server started with PID: ${child.pid} (restart #${restartCount})`);

  const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
  child.stdout.pipe(logStream);
  child.stderr.pipe(logStream);

  child.on('exit', (code, signal) => {
    const now = Date.now();
    console.log(`[watchdog] Server exited with code=${code} signal=${signal}`);
    
    // Reset restart count if server ran for more than 30 seconds (stable)
    if (now - lastRestartTime > 30000) {
      restartCount = 0;
    }
    
    restartCount++;
    lastRestartTime = now;
    
    if (restartCount < MAX_RESTARTS) {
      console.log(`[watchdog] Restarting in ${RESTART_DELAY}ms... (attempt ${restartCount}/${MAX_RESTARTS})`);
      setTimeout(startServer, RESTART_DELAY);
    } else {
      console.error(`[watchdog] Max restarts (${MAX_RESTARTS}) reached. Giving up.`);
    }
  });

  child.on('error', (err) => {
    console.error(`[watchdog] Server error: ${err.message}`);
  });

  return child;
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('[watchdog] Received SIGTERM, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[watchdog] Received SIGINT, shutting down...');
  process.exit(0);
});

startServer();
