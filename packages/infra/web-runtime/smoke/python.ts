// Python smoke page: the runtime's python3 (src/python) as a Node program of the file system spawns
// it: a command and its exit code, the version, standard input and output through pipes, a script
// run by its #! line, a virtual environment, packages installed with pip into it (one of Pyodide's
// builds, a requirements file and the machine's wheel of the SDK) and imported by a later process, and
// files both sides see.
import { BackendHost } from '../src/host/BackendHost';

const report = (step: string, value: unknown): void => console.log(`SMOKE ${step} ${JSON.stringify(value)}`);

const DIRECTORY = 'volt-smoke-python';

const SCRIPT = `#!/usr/bin/env python3
import sys
print("script", sys.argv[1:])
`;

const PARENT = `
const { spawn } = require('child_process');
const fs = require('fs');
const report = (step, value) => console.log('SMOKE ' + step + ' ' + JSON.stringify(value));
const run = (command, args, input) => new Promise((resolve) => {
    const child = spawn(command, args, { env: { PATH: '/usr/local/bin:/usr/bin:/bin', HOME: '/home/volt' }, cwd: '/tmp' });
    const out = [];
    let err = '';
    child.stdout.on('data', (chunk) => out.push(chunk));
    child.stderr.on('data', (chunk) => { err += chunk; });
    child.on('error', (error) => resolve({ error: error.code }));
    child.on('close', (code) => resolve({ code, stdout: Buffer.concat(out).toString(), stderr: err.slice(-2000) }));
    child.stdin.end(input);
});
(async () => {
    const startedAt = Date.now();
    const command = await run('python3', ['-c', 'import sys; print(sys.version_info[:2], sys.executable, sys.prefix); sys.exit(3)']);
    report('command', { ...command, seconds: Math.round((Date.now() - startedAt) / 1000) });
    report('version', await run('python3', ['-V']));
    report('pipe', await run('python3', ['-c', 'import sys; data = sys.stdin.buffer.read(); sys.stdout.buffer.write(data[::-1])'], 'stdin to stdout'));
    report('script', await run('/tmp/hello.py', ['a', 'b']));
    report('venv', await run('python3', ['-m', 'venv', '/tmp/env']));
    report('venv-prefix', await run('/tmp/env/bin/python3', ['-c', 'import sys, site; print(sys.prefix, sys.base_prefix, site.getsitepackages())']));
    report('pip-install', await run('/tmp/env/bin/python3', ['-m', 'pip', 'install', 'numpy']));
    report('pip-requirements', await run('/tmp/env/bin/python3', ['-m', 'pip', 'install', '-r', '/tmp/requirements.txt']));
    report('pip-local-wheel', await run('/tmp/env/bin/python3', ['-m', 'pip', 'install', '--no-deps', 'voltsdk']));
    report('import', await run('/tmp/env/bin/python3', ['-c', 'import numpy, msgpack; print(int(numpy.arange(4).sum()), msgpack.unpackb(msgpack.packb([1, 2])))']));
    report('pip-list', await run('/tmp/env/bin/python3', ['-m', 'pip', 'freeze']));
    report('files', await run('python3', ['-c', 'open("/tmp/from-python.txt", "w").write("written by python")']));
    report('files-read', fs.readFileSync('/tmp/from-python.txt', 'utf8'));
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
    const storage = await navigator.storage.getDirectory();
    await storage.removeEntry(DIRECTORY, { recursive: true }).catch(() => {});
    const root = await storage.getDirectoryHandle(DIRECTORY, { create: true });
    await writeFile(root, '/tmp/hello.py', SCRIPT);
    await writeFile(root, '/tmp/requirements.txt', '# a comment\nmsgpack>=1.0  # inline\n');
    await writeFile(root, '/tmp/parent.js', PARENT);

    const host = new BackendHost();
    host.onExit = (name, code) => report('exit', { name, code });
    void host.start({
        name: 'parent',
        scriptUrl: new URL('../node-runner.worker.js', import.meta.url),
        port: -1,
        boot: { env: {}, script: '/tmp/parent.js', argv: [], cwd: '/tmp', fs: { directory: DIRECTORY } }
    }).catch((error: Error) => report('error', error.message));
};

run().catch((error: Error) => report('error', error.stack ?? error.message));
