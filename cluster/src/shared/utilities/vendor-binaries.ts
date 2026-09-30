import { existsSync } from 'node:fs';
import path from 'node:path';

export const vendorBinaryName = (name: string): string =>
    process.platform === 'win32' ? `${name}.exe` : name;

export const vendorBinaryCandidates = (toolDir: string, binaryName: string): string[] => {
    const rel = path.join('vendor', toolDir, 'bin', binaryName);
    const candidates = [path.join(process.cwd(), rel)];
    let dir = __dirname;
    for (let i = 0; i < 8; i += 1) {
        candidates.push(path.join(dir, rel));
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    return [...new Set(candidates)];
};

export const firstExistingPath = (candidates: readonly string[]): string | null =>
    candidates.find((candidate) => existsSync(candidate)) ?? null;
