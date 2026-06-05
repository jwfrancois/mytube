const { spawn } = require('child_process');
const fs = require('fs');

const out = fs.openSync('/tmp/next-server.log', 'a');
const err = fs.openSync('/tmp/next-server-error.log', 'a');

const child = spawn('npx', ['next', 'dev', '-p', '3000', '-H', '0.0.0.0'], {
  cwd: '/home/z/my-project',
  detached: true,
  stdio: ['ignore', out, err]
});

child.unref();

fs.writeFileSync('/tmp/next-server.pid', child.pid.toString());
console.log(`Server started with PID: ${child.pid}`);
