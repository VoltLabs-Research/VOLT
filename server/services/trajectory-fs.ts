/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

type Media = 'raster' | 'glb' | 'both';

export interface MediaMaps{
    raster?: Record<string, string>;
    glb?: Record<string, string>;
}

export interface PreviewsResult extends MediaMaps{
    previewPng?: string | null;
}

export interface GetOptions{
    media?: Media;
}

class TrajectoryFS{
    readonly trajectoryId: string;
    readonly root: string;

    constructor(trajectoryId: string, baseDir = process.env.TRAJECTORY_DIR){
        if(!baseDir){
            throw new Error('TRAJECTORY_DIR is not not defined.')
        }
        this.trajectoryId = trajectoryId;
        this.root = path.resolve(baseDir, trajectoryId);
    }

    private async isDir(p: string): Promise<boolean>{
        try{
            const stat = await fs.stat(p);
            return stat.isDirectory();
        }catch{
            return false;
        }
    }

    private async isFile(p: string): Promise<boolean>{
        try{
            const stat = await fs.stat(p);
            return stat.isFile();
        }catch{
            return false;
        }
    }

    private async readDir(p: string): Promise<string[]>{
        try{
            return await fs.readdir(p);
        }catch{
            return [];
        }
    }

    private numSort(a: string, b: string): number{
        const na = Number(a);
        const nb = Number(b);
        const anum = Number.isFinite(na);
        const bnum = Number.isFinite(nb);

        if(anum && bnum) return na - nb;
        if(anum && !bnum) return -1;
        if(!anum && bnum) return 1;

        return a.localeCompare(b);
    };

    async getDump(frame: string | number): Promise<string | null>{
        const p = path.join(this.dumpsDir(), String(frame));
        const isFile = await this.isFile(p);
        return isFile ? p : null;
    }

    private previewsDir(media?: Exclude<Media, 'both'>): string{
        return media 
            ? path.join(this.root, 'previews', media)
            : path.join(this.root, 'previews');
    }

    private analysisMediaDir(analysisId: string, media: Exclude<Media, 'both'>): string{
        return path.join(this.root, analysisId, media);
    }

    private frameDir(analysisId: string, media: Exclude<Media, 'both'>, frame: string): string{
        return path.join(this.analysisMediaDir(analysisId, media), frame);
    }

    private async collectFilesWithExt(dir: string, wantedExt: string): Promise<Record<string, string>>{
        const out: Record<string, string> = {};

        const isDir = await this.isDir(dir);
        if(!isDir) return out;

        const entries = await this.readDir(dir);
        for(const name of entries){
            const abs = path.join(dir, name);
        
            const isFile = await this.isFile(abs);
            if(!isFile) continue;

            const ext = path.extname(name).toLowerCase();
            if(ext !== wantedExt) continue;

            const base = path.basename(name, ext);
            out[base] = abs;
        }

        return out;
    }

    private async ensureDir(p: string): Promise<void>{
        await fs.mkdir(p, { recursive: true });
    }
    
    private async collectFramesForType(
        analysisId: string,
        media: Exclude<Media, 'both'>,
        analysisType: string,
        expectedExt: string
    ): Promise<Record<string, string>>{
        const mediaRoot = this.analysisMediaDir(analysisId, media);
        const frames = await this.readDir(mediaRoot);
        const result: Record<string, string> = {};

        for(const frame of frames.sort(this.numSort)){
            const fdir = path.join(mediaRoot, frame);

            const isDir = await this.isDir(fdir);
            if(!isDir) continue;

            const fpath = path.join(fdir, `${analysisType}${expectedExt}`);
            const isFile = await this.isFile(fpath);
            if(isFile){
                result[frame] = fpath;
            }
        }

        return result;
    }

    private want(media?: Media): { raster: boolean, glb: boolean }{
        const m = media ?? 'both';
        return {
            raster: m === 'raster' || m === 'both',
            glb: m === 'glb' || m === 'both'
        };
    }

    private dumpsDir(): string{
        return path.join(this.root, 'dumps');
    }

    private async getPreviewPNG(){
        const png = path.join(this.root, 'preview.png');
        const isFile = await this.isFile(png);
        return isFile ? png : null;
    }

    async getPreviews(options?: GetOptions): Promise<PreviewsResult>{
        const { raster, glb } = this.want(options?.media);
        const result: PreviewsResult = {};
        result.previewPng = await this.getPreviewPNG();

        if(raster){
            const dir = this.previewsDir('raster');
            const map = await this.collectFilesWithExt(dir, '.png');
            const ordered: Record<string, string> = {};
            for(const k of Object.keys(map).sort(this.numSort)){
                ordered[k] = map[k];
            }
            result.raster = ordered;
        }

        if(glb){
            const dir = this.previewsDir('glb');
            const map = await this.collectFilesWithExt(dir, '.glb');
            const ordered: Record<string, string> = {};
            for(const k of Object.keys(map).sort(this.numSort)){
                ordered[k] = map[k];
            }
            result.glb = ordered;
        }

        return result;
    }

    async ensureStructure(): Promise<void>{
        await this.ensureDir(this.root);
        await this.ensureDir(this.dumpsDir());
        await this.ensureDir(this.previewsDir('raster'));
        await this.ensureDir(this.previewsDir('glb'));
    }

    async getDumps(): Promise<Record<string, string>>{
        const dir = this.dumpsDir();
        const out: Record<string, string> = {};
        const isDir = await this.isDir(dir);
        if(!isDir) return out;

        const items = await this.readDir(dir);
        for(const name of items){
            const abs = path.join(dir, name)
            const isFile = await this.isFile(abs);
            if(isFile){
                out[name] = abs;
            }
        }

        const ordered: Record<string, string> = {};
        for(const k of Object.keys(out).sort(this.numSort)){
            ordered[k] = out[k];
        }
        return ordered;
    }

    async saveDump(frame: string | number, bufferOrSrc: Buffer | string, overwrite = true): Promise<string>{
        const destDir = this.dumpsDir();
        await this.ensureDir(destDir);
        const dest = path.join(destDir, String(frame));
        const isFile = await this.isFile(dest);
        if(!overwrite && isFile){
            return dest;
        }
        if(typeof bufferOrSrc === 'string'){
            const data = await fs.readFile(bufferOrSrc);
            await fs.writeFile(dest, data);
        }else{
            await fs.writeFile(dest, bufferOrSrc);
        }
        return dest;
    }

    async listRasterAnalyses(
        frame: number | string,
        analysisId: string
    ): Promise<string[]>{
        // <trajectory_dir>/<trajectory_id>/<analysis_id>/raster/<frame>
        const frameDir = path.join(this.root, analysisId, 'raster', String(frame));
        const isDir = await this.isDir(frameDir);
        if(!isDir) return [];

        const entries = await this.readDir(frameDir);
        const types = new Set<string>();

        for(const name of entries){
            const abs = path.join(frameDir, name);
            const isFile = await this.isFile(abs);
            if(!isFile) continue;

            const analysisType = path.basename(name, '.png');
            // TODO: add external exclude list
            if(analysisType === 'interface_mesh') continue;
            types.add(analysisType);
        }

        return Array.from(types);
    }

    async getAnalysis(analysisId: string, analysisType: string, options?: GetOptions): Promise<MediaMaps>{
        const { raster, glb } = this.want(options?.media);
        const result: MediaMaps = {};

        if(raster){
            result.raster = await this.collectFramesForType(analysisId, 'raster', analysisType, '.png');
        }

        if(glb){
            result.glb = await this.collectFramesForType(analysisId, 'glb', analysisType, '.glb');
        }

        return result;
    }
};

export default TrajectoryFS;