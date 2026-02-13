#!/usr/bin/env node
'use strict';

const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

// Keep console open on fatal errors so the user can read them
function waitForKeyThenExit(code) {
  console.error('\n  Press Enter to close this window...');
  const rl = readline.createInterface({ input: process.stdin });
  rl.once('line', () => process.exit(code));
}

process.on('uncaughtException', (err) => {
  console.error('\n  ERROR: ' + err.message);
  if (err.message.includes('better_sqlite3') || err.message.includes('.node')) {
    console.error('  This usually means the native module was built for a different platform.');
    console.error('  Rebuild the binary on the target platform (e.g., Windows for .exe).');
  }
  waitForKeyThenExit(1);
});

// When running inside a pkg-packaged binary, process.pkg is defined
// and __dirname points to the snapshot filesystem (read-only).
// We need the database to live next to the executable.
if (process.pkg) {
  process.env.DB_DIR = path.dirname(process.execPath);
}

process.env.NODE_ENV = 'production';

// Load the esbuild-bundled server
require('./server.cjs');

// Auto-open the browser after a short delay to let the server start
const PORT = process.env.PORT || 3000;
const url = `http://localhost:${PORT}`;

setTimeout(() => {
  console.log(`\n  Forbidden North Tracker is running!`);
  console.log(`  Open your browser to: ${url}`);
  console.log(`  Press Ctrl+C to stop the server.\n`);

  try {
    const platform = process.platform;
    if (platform === 'win32') {
      execSync(`start "" "${url}"`, { stdio: 'ignore' });
    } else if (platform === 'darwin') {
      execSync(`open "${url}"`, { stdio: 'ignore' });
    } else {
      execSync(`xdg-open "${url}"`, { stdio: 'ignore' });
    }
  } catch {
    // Browser open failed — user can navigate manually
  }
}, 1500);
