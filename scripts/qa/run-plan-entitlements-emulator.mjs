import { accessSync, constants } from 'node:fs';
import { spawnSync } from 'node:child_process';

const projectId = 'demo-summa-entitlements';
const javaCandidates = [
  process.env.JAVA_HOME ? `${process.env.JAVA_HOME}/bin/java` : null,
  '/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home/bin/java',
  '/opt/homebrew/opt/openjdk@21/bin/java',
  '/usr/local/opt/openjdk@21/bin/java',
].filter(Boolean);

function executable(path) {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function javaMajor(path) {
  const probe = spawnSync(path, ['-version'], { encoding: 'utf8' });
  const output = `${probe.stdout || ''}\n${probe.stderr || ''}`;
  const match = output.match(/version "(?:1\.)?(\d+)/);
  return match ? Number(match[1]) : 0;
}

const java = javaCandidates.find((candidate) => executable(candidate) && javaMajor(candidate) >= 21);
if (!java) {
  console.error('Java 21+ is required by firebase-tools to run the Firestore and Storage emulators.');
  process.exit(2);
}

const firebase = spawnSync('firebase', [
  'emulators:exec',
  '--config', 'firebase.plan-entitlements.json',
  '--only', 'firestore,storage,auth',
  '--project', projectId,
  'node scripts/qa/plan-entitlements-emulator.mjs',
], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    JAVA_HOME: java.replace(/\/bin\/java$/, ''),
    PATH: `${java.replace(/\/bin\/java$/, '/bin')}:${process.env.PATH || ''}`,
  },
  encoding: 'utf8',
  stdio: 'inherit',
});

if (firebase.error) {
  console.error(firebase.error.message);
  process.exit(1);
}
process.exit(firebase.status ?? 1);
