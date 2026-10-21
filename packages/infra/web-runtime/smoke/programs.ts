// Programs smoke page: Node programs of the file system, run by the node runner. A parent script
// spawns children as executables (by their #!/usr/bin/env node line, found on PATH), pipes bytes
// through their stdin and stdout, and checks exit codes, stdio modes and a missing command.
import { BackendHost } from '../src/host/BackendHost';

const report = (step: string, value: unknown): void => console.log(`SMOKE ${step} ${JSON.stringify(value)}`);

const DIRECTORY = 'volt-smoke-programs';

// Copies stdin to stdout with blocking reads of fd 0 and writes to fd 1, as a program compiled for
// Node does, then exits with the code in its first argument.
const COPY = `#!/usr/bin/env node
const fs = require('fs');
const chunk = Buffer.alloc(4096);
let total = 0;
for(let count; (count = fs.readSync(0, chunk, 0, chunk.length, null)) > 0;){
    fs.writeSync(1, chunk, 0, count);
    total += count;
}
fs.writeSync(2, 'copied ' + total + '\\n');
process.exit(Number(process.argv[2] ?? 0));
`;

const PARENT = `
const { spawn } = require('child_process');
const crypto = require('crypto');
const report = (step, value) => console.log('SMOKE ' + step + ' ' + JSON.stringify(value));
const run = (command, args, options, input) => new Promise((resolve) => {
    const child = spawn(command, args, options);
    const out = [];
    let err = '';
    child.stdout?.on('data', (chunk) => out.push(chunk));
    child.stderr?.on('data', (chunk) => { err += chunk; });
    child.on('error', (error) => resolve({ error: error.code }));
    child.on('close', (code) => resolve({ code, stdout: Buffer.concat(out), stderr: err }));
    if(child.stdin){
        child.stdin.end(input);
    }
});
(async () => {
    const input = crypto.randomBytes(3 * 1024 * 1024 + 17);
    const piped = await run('copy', ['0'], { env: { PATH: '/usr/local/bin' } }, input);
    report('pipe', { code: piped.code, same: piped.stdout.equals(input), stderr: piped.stderr.trim() });
    const failed = await run('/usr/local/bin/copy', ['7'], { stdio: ['ignore', 'pipe', 'pipe'] });
    report('exit-code', { code: failed.code, bytes: failed.stdout.length, stderr: failed.stderr.trim() });
    const viaNode = await run(process.execPath, ['/usr/local/bin/copy', '0'], {}, Buffer.from('hello'));
    report('node-script', { code: viaNode.code, stdout: viaNode.stdout.toString() });
    const missing = await run('volt-no-such-command', [], { env: { PATH: '/usr/local/bin' } });
    report('missing', missing);
})().then(
    () => {
        report('done', true);
        process.exit(0);
    },
    (error) => {
        report('error', error.stack);
        process.exit(1);
    }
);
`;

const writeFile = async (root: FileSystemDirectoryHandle, filePath: string, text: string): Promise<void> => {
    const parts = filePath.split('/').filter(Boolean);
    let directory = root;
    for(const part of parts.slice(0, -1)){
        directory = await directory.getDirectoryHandle(part, { create: true });
    }
    const writable = await (await directory.getFileHandle(parts.at(-1)!, { create: true })).createWritable();
    await writable.write(text);
    await writable.close();
};

const run = async (): Promise<void> => {
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle(DIRECTORY, { create: true });
    await writeFile(root, '/usr/local/bin/copy', COPY);
    await writeFile(root, '/tmp/parent.js', PARENT);

    const host = new BackendHost();
    host.onExit = (name, code) => report('exit', { name, code });
    // The runner serves no port: the parent reports its checks itself and exits.
    void host.start({
        name: 'parent',
        scriptUrl: new URL('../node-runner.worker.js', import.meta.url),
        port: -1,
        boot: { env: {}, script: '/tmp/parent.js', argv: [], cwd: '/tmp', fs: { directory: DIRECTORY } }
    }).catch((error: Error) => report('error', error.message));
};

run().catch((error: Error) => report('error', error.stack ?? error.message));
