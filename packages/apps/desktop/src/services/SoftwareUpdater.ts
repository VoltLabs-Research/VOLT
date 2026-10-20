import { RepositoryRelease } from '@/services/Repository';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, readdir, rm, unlink } from 'node:fs/promises';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { pipeline } from 'node:stream/promises';
import { PassThrough } from 'node:stream';
import path from 'path';
import extractZip from 'extract-zip';
import bus from '@/services/EventBus';

const extractRoot = (downloadDir: string, repoId: string) => path.join(downloadDir, repoId);

const download = async (repoId: string, release: RepositoryRelease, downloadPath: string) => {
    const res = await fetch(release.zipballUrl);
    if(!res.ok || !res.body) throw new Error(`Error HTTP: ${res.status}`);

    let bytes = 0;
    let lastPct = -1;
    const total = Number(res.headers.get('content-length') ?? 0);

    const counter = new PassThrough();
    counter.on('data', (chunk: Buffer) => {
        bytes += chunk.length;

        const pct = total ? Math.floor(bytes / total * 100) : -1;
        if(pct !== lastPct){
            lastPct = pct;
            bus.emit('source:progress', {
                repoId,
                phase: 'download',
                bytes,
                total: total || undefined,
                pct: pct >= 0 ? pct : undefined
            });
        }
    });

    await pipeline(Readable.fromWeb(res.body as NodeReadableStream<Uint8Array>), counter, createWriteStream(downloadPath));
};

const extract = async (zipPath: string, outputDir: string) => {
    await rm(outputDir, {
        recursive: true,
        force: true
    });
    await mkdir(outputDir, { recursive: true }).catch(() => {});

    await extractZip(zipPath, {
        dir: path.resolve(outputDir)
    });
};

export const resolveExtractedPath = async (downloadDir: string, repoId: string) => {
    const root = extractRoot(downloadDir, repoId);
    if(!existsSync(root)) throw new Error(`No source for ${repoId} at ${root}`);

    const entries = await readdir(root, { withFileTypes: true });
    const inner = entries.find((entry) => entry.isDirectory());
    if(!inner) throw new Error(`Extracted archive ${repoId} has no top-level dir`);

    return path.join(root, inner.name);
};

export const installRelease = async (downloadDir: string, repoId: string, release: RepositoryRelease) => {
    const safeId = repoId.replace('/', '_');
    const downloadPath = path.join(downloadDir, `${safeId}-${release.tag}.zip`);

    await mkdir(downloadDir, { recursive: true });

    await download(repoId, release, downloadPath);

    bus.emit('source:progress', {
        repoId,
        phase: 'extract'
    });
    await extract(downloadPath, extractRoot(downloadDir, repoId));

    await unlink(downloadPath);
    bus.emit('source:progress', {
        repoId,
        phase: 'done'
    });

    return resolveExtractedPath(downloadDir, repoId);
};
