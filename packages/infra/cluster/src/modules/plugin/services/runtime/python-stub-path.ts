import path from 'node:path';

// copy-static-assets mirrors services/python next to the compiled runtime/ directory.
export const resolvePythonStubPath = (): string =>
    path.resolve(__dirname, '..', 'python', 'volt_plugin_stub.py');
