import { SYS_BUCKETS } from '@/config/minio';
import { encodeMsgpack } from '@/utilities/msgpack';
import { slugify } from '@/utilities/runtime';
import { putObject } from '@/utilities/buckets';
import { unlink } from 'node:fs/promises';
import { WriteStream, createReadStream, createWriteStream } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export default class SummaryStreamWriter{
    private tmpPath: string;
    private stream: WriteStream | null = null;
    private hasData = false;

    constructor(
        private pluginName: string,
        private trajectoryId: string,
        private analysisId: string,
        private artifactName: string,
        private timestep: number
    ){
        const artifactKey = slugify(this.artifactName);
        this.tmpPath = path.join(
            os.tmpdir(),
            `opendxa-summary-${this.pluginName}-${artifactKey}-${this.trajectoryId}-${this.analysisId}-${this.timestep}-${Date.now()}.msgpack`
        );
    }

    async append(chunk: unknown): Promise<void>{
        if(!this.stream){
            this.stream = createWriteStream(this.tmpPath);
        }
        
        this.hasData = true;
        const buffer = encodeMsgpack(chunk);
        await new Promise<void>((resolve, reject) => {
            this.stream!.write(buffer, (err) => {
                if(err) return reject(err);
                resolve();
            });
        });
    }

    get wroteAny(): boolean{
        return this.hasData;
    }

    getTempPath(): string{
        return this.tmpPath;
    }

    async finalizeAndUpload(): Promise<{ storageKey: string } | null>{
        if(!this.hasData){
            return null;
        }

        if(this.stream){
            await new Promise<void>((resolve, reject) => {
                this.stream!.end((err: any) => {
                    if(err) return reject(err);
                    resolve();
                })
            });
        }

        const artifactKey = slugify(this.artifactName);
        const storageKey = [
            'plugins',
            `trajectory-${this.trajectoryId}`,
            `analysis-${this.analysisId}`,
            artifactKey,
            `timestep-${this.timestep}.msgpack`
        ].join('/');

        const readStream = createReadStream(this.tmpPath);
        await putObject(storageKey, SYS_BUCKETS.PLUGINS, readStream, {
            'Content-Type': 'application/msgpack'
        });

        await unlink(this.tmpPath).catch((err) => {
            console.error(`[${this.pluginName} plugin] failed to delete tmp summary ${this.tmpPath}:`, err);
        });

        return { storageKey };
    }
};