import type { ReleaseAsset } from '@/services/ReleaseChecker';
import { createWriteStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises';
import path from 'path';
import extractZip from 'extract-zip';
import ReleaseChecker from '@/services/ReleaseChecker';

export interface SoftwareUpdaterProps{
    downloadDir: string;
    appAssets: string[];
}

export default class SoftwareUpdater{
    props: SoftwareUpdaterProps
    
    constructor(props: SoftwareUpdaterProps){
        this.props = props; 
    }

    async #download(asset: ReleaseAsset, downloadPath: string){
        const res = await fetch(asset.browser_download_url);
        if(!res.ok) throw new Error(`Error HTTP: ${res.status}`);

        await pipeline(Readable.fromWeb(res.body), createWriteStream(downloadPath));
    }

    async #extract(zipPath: string, outputDir: string){
        await mkdir(outputDir);

        await extractZip(zipPath, {
            dir: path.resolve(outputDir),
        });
    }

    async update(assets: ReleaseAsset[]){
        const validAssets = assets.filter(({ name }) => this.props.appAssets.includes(name));
        
        for(const asset of validAssets){
            const downloadPath = `${this.props.downloadDir}/${asset.name}.zip`;
            const extractPath = `${this.props.downloadDir}/${asset.name}`;

            await this.#download(asset, downloadPath);
            await this.#extract(downloadPath, extractPath);

            await unlink(downloadPath);
        }
    }
};

(async () => {
    const checker = new ReleaseChecker({
        repo: 'Test-VOLT',
        owner: 'rodyherrera'
    });

    const assets = await checker.discover();

    const updater = new SoftwareUpdater({ downloadDir: './downloads/', appAssets: ['dist.zip'] });
    updater.update(assets);
})();
