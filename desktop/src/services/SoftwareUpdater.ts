import { RepositoryRelease } from '@/services/Repository';
import { createWriteStream } from 'node:fs';
import { mkdir, readdir, unlink } from 'node:fs/promises';
import { Readable } from 'node:stream'
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
    props: SoftwareUpdaterProps
    
    constructor(props: SoftwareUpdaterProps){
        this.props = props; 
    }

    async #download(release: RepositoryRelease, downloadPath: string){
        const res = await fetch(release.zipballUrl);
        if(!res.ok) throw new Error(`Error HTTP: ${res.status}`);

        let bytes = 0;
        let lastPct = -1;
        const total = Number(res.headers.get('content-length') ?? 0);

        const counter = new PassThrough();
        counter.on('data', (chunk: Buffer) => {
            bytes += chunk.length;

            const pct = total ? Math.floor(bytes / total * 100) : - 1;
            if(pct !== lastPct){
                lastPct = pct;
                bus.emit('source:progress', {
                    repoId: this.props.repoId,
                    phase: 'download',
                    bytes
                });
            }
        });

        await pipeline(Readable.fromWeb(res.body), counter, createWriteStream(downloadPath));
    }

    async #extract(zipPath: string, outputDir: string){
        await mkdir(outputDir, { recursive: true }).catch(() => {});

        await extractZip(zipPath, {
            dir: path.resolve(outputDir),
        });
    }

    async update(release: RepositoryRelease){
        const downloadPath = `${this.props.downloadDir}/${release.tag}.zip`;
        const extractPath = `${this.props.downloadDir}/${this.props.repoId}`;

        await this.#download(release, downloadPath);

        bus.emit('source:progress', { repoId: this.props.repoId, phase: 'extract' });
        await this.#extract(downloadPath, extractPath);

        await unlink(downloadPath);
        bus.emit('source:progress', { repoId: this.props.repoId, phase: 'done' });

        const entries = await readdir(extractPath, { withFileTypes: true });
        const inner = entries.find((entry) => entry.isDirectory());
        if(!inner) throw new Error('extracted archive has no top-level dir');

        return path.join(extractPath, inner.name);
    }
};