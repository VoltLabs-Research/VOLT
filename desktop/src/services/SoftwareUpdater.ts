import { RepositoryRelease } from '@/services/Repository';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, readdir, rm, unlink } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { PassThrough } from 'node:stream';
import path from 'path';
import extractZip from 'extract-zip';
import bus from '@/services/EventBus';

export interface SoftwareUpdaterProps{
    downloadDir: string;
    repoId: string;
}

export default class SoftwareUpdater{
    constructor(private readonly props: SoftwareUpdaterProps){}

    #extractRoot(){
        return path.join(this.props.downloadDir, this.props.repoId);
    }

    async #download(release: RepositoryRelease, downloadPath: string){
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
                    repoId: this.props.repoId,
                    phase: 'download',
                    bytes
                });
            }
        });

        await pipeline(Readable.fromWeb(res.body as any), counter, createWriteStream(downloadPath));
    }

    async #extract(zipPath: string, outputDir: string){
        // Wipe any previously extracted release first: GitHub zipballs unpack
        // to a per-commit top-level dir, so without this the root accumulates
        // stale dirs and resolveExtractedPath() can pick the old source —
        // making Docker rebuild the web-app from outdated code.
        await rm(outputDir, { recursive: true, force: true });
        await mkdir(outputDir, { recursive: true }).catch(() => {});

        await extractZip(zipPath, {
            dir: path.resolve(outputDir)
        });
    }

    async update(release: RepositoryRelease){
        const safeId = this.props.repoId.replace('/', '_');
        const downloadPath = path.join(this.props.downloadDir, `${safeId}-${release.tag}.zip`);
        const extractPath = this.#extractRoot();

        await mkdir(this.props.downloadDir, { recursive: true });

        await this.#download(release, downloadPath);

        bus.emit('source:progress', { repoId: this.props.repoId, phase: 'extract' });
        await this.#extract(downloadPath, extractPath);

        await unlink(downloadPath);
        bus.emit('source:progress', { repoId: this.props.repoId, phase: 'done' });

        return this.resolveExtractedPath();
    }

    async resolveExtractedPath(){
        const root = this.#extractRoot();
        if(!existsSync(root)) throw new Error(`No source for ${this.props.repoId} at ${root}`);

        const entries = await readdir(root, { withFileTypes: true });
        const inner = entries.find((entry) => entry.isDirectory());
        if(!inner) throw new Error(`Extracted archive ${this.props.repoId} has no top-level dir`);

        return path.join(root, inner.name);
    }
};
