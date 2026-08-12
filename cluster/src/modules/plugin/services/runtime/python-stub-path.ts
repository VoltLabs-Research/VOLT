import path from 'node:path';
import fs from 'node:fs';

export const resolvePythonStubPath = (): string => {
    const candidates = [
        path.resolve(__dirname, '..', 'python', 'volt_plugin_stub.py'),
        path.resolve(process.cwd(), 'src', 'modules', 'plugin', 'services', 'python', 'volt_plugin_stub.py')
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return candidates[0];
};
