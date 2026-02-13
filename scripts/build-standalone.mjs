#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// Read version from package.json
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { cwd: root, stdio: 'inherit' });
}

// Determine target platform from args or current platform
const argTarget = process.argv[2]; // e.g., "win", "mac", "linux"
const pkgTargetMap = {
  win: 'node20-win-x64',
  mac: 'node20-macos-x64',
  linux: 'node20-linux-x64',
};
const outputNameMap = {
  win: `forbidden-north-tracker-${version}-win.exe`,
  mac: `forbidden-north-tracker-${version}-mac`,
  linux: `forbidden-north-tracker-${version}-linux`,
};

const platformKey = argTarget || { win32: 'win', darwin: 'mac', linux: 'linux' }[process.platform];
if (!platformKey || !pkgTargetMap[platformKey]) {
  console.error(`Unknown platform: ${argTarget || process.platform}`);
  process.exit(1);
}

const pkgTarget = pkgTargetMap[platformKey];
const outputName = outputNameMap[platformKey];

console.log(`\nBuilding standalone binary for: ${platformKey} (${pkgTarget})\n`);

// 1. Clean build/ and release/ directories
console.log('Step 1: Cleaning build directories...');
fs.rmSync(path.join(root, 'build'), { recursive: true, force: true });
fs.mkdirSync(path.join(root, 'build'), { recursive: true });
fs.mkdirSync(path.join(root, 'release'), { recursive: true });

// 2. Build frontend with Vite
console.log('\nStep 2: Building frontend...');
run('npx vite build');

// 3. Bundle server with esbuild (ESM → CJS, better-sqlite3 external)
console.log('\nStep 3: Bundling server with esbuild...');
run([
  'npx esbuild server/index.js',
  '--bundle',
  '--platform=node',
  '--format=cjs',
  '--external:better-sqlite3',
  '--outfile=build/server.cjs',
].join(' '));

// Post-process: esbuild emits `var import_meta = {};` for each import.meta usage
// in CJS output. Replace these with a proper shim so fileURLToPath(import.meta.url)
// resolves __dirname correctly inside the bundle (and inside pkg's snapshot FS).
console.log('  Patching import.meta shim in bundled output...');
let bundled = fs.readFileSync(path.join(root, 'build', 'server.cjs'), 'utf8');
bundled = bundled.replace(
  /var (import_meta\d*) = \{\};/g,
  'var $1 = { url: require("url").pathToFileURL(__filename).href };',
);
fs.writeFileSync(path.join(root, 'build', 'server.cjs'), bundled);

// 4. Copy standalone wrapper
console.log('\nStep 4: Copying standalone wrapper...');
fs.copyFileSync(
  path.join(root, 'scripts', 'standalone-wrapper.cjs'),
  path.join(root, 'build', 'standalone.cjs'),
);

// 5. Download the correct native module for the target platform
const betterSqlite3Dir = path.join(root, 'node_modules', 'better-sqlite3');
const nativeModulePath = path.join(betterSqlite3Dir, 'build', 'Release', 'better_sqlite3.node');
const nativeModuleBackup = nativeModulePath + '.bak';
const prebuildPlatformMap = { win: 'win32', mac: 'darwin', linux: 'linux' };
const needsCrossPlatformNative = prebuildPlatformMap[platformKey] !== process.platform;

if (needsCrossPlatformNative) {
  console.log(`\nStep 5: Downloading native module for ${platformKey}...`);
  // Back up the current (host-platform) native module
  fs.copyFileSync(nativeModulePath, nativeModuleBackup);
  try {
    // Run from better-sqlite3 dir so prebuild-install reads its package.json
    execSync([
      'npx prebuild-install',
      `--platform ${prebuildPlatformMap[platformKey]}`,
      '--arch x64',
      '--tag-prefix v',
      '-r node',
      '-t 20.0.0',
    ].join(' '), { cwd: betterSqlite3Dir, stdio: 'inherit' });
  } catch (err) {
    // Restore backup if download fails
    fs.copyFileSync(nativeModuleBackup, nativeModulePath);
    console.error('Failed to download native module for target platform.');
    console.error('The binary may not work on the target platform.');
  }
}

// 6. Package with pkg
console.log(`\nStep ${needsCrossPlatformNative ? '6' : '5'}: Packaging with pkg...`);

run([
  'npx pkg build/standalone.cjs',
  `--target ${pkgTarget}`,
  `--output release/${outputName}`,
  '--config package.json',
].join(' '));

// Restore original native module if we swapped it
if (needsCrossPlatformNative && fs.existsSync(nativeModuleBackup)) {
  console.log('Restoring host-platform native module...');
  fs.copyFileSync(nativeModuleBackup, nativeModulePath);
  fs.unlinkSync(nativeModuleBackup);
}

console.log(`\nDone! Binary written to: release/${outputName}\n`);
