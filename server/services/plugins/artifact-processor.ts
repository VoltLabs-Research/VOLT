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

import { SYS_BUCKETS } from '@/config/minio';
import { putObject } from '@/utilities/buckets';
import { slugify } from '@/utilities/runtime';
import { encodeMsgpack, readMsgpackFile } from '@/utilities/msgpack';
import DislocationExporter from '@/utilities/export/dislocations';
import MeshExporter from '@/utilities/export/mesh';
import SummaryStreamWriter from './summary-stream-writer';
import AtomisticExporter from '@/utilities/export/atoms';
import path from 'node:path';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import { decodeArrayStreamFromFile } from '@/utilities/msgpack-iterable';

type BuiltInExports = 'AtomisticExporter' | 'MeshExporter' | 'DislocationExporter';

export interface ArtifactExport {
    name: BuiltInExports;
    handler?: string;
    type: string;
    opts: any;
};

export interface Artifact{
    id: string;
    resultFile: string;
    exportConfig?: ArtifactExport;
    iterableKey?: string;
    iterableChunkSize?: number;
};

export interface ExecutionRecorder{
    recordUpload(bucket: string, key: string): void;
};

export interface ArtifactTransformContext{
    pluginName: string;
    trajectoryId: string;
    analysisId: string;
    timestep: number;
    artifact: Artifact;
    filePath: string;

    iterateChunks(): AsyncIterable<Buffer>;
    readAllAsBuffer(): Promise<Buffer>;
    writeChunk(chunk: unknown): Promise<void>;
}

export type ArtifactTransformer = (ctx: ArtifactTransformContext) => Promise<any | null> | any | null;

export default class ArtifactProcessor{
    constructor(
        private pluginsDir: string,
        private pluginName: string,
        private trajectoryId: string,
        private analysisId: string,
        private recorder: ExecutionRecorder
    ){}

    async evaluate<T>(artifact: Artifact, timestep: number, filePath: string): Promise<void>{
        await this.saveRawResult(artifact, timestep, filePath);

        const summaryWriter = new SummaryStreamWriter(
            this.pluginName,
            this.trajectoryId,
            this.analysisId,
            artifact.id,
            timestep
        );

        const summary = await this.applyTransformer(
            artifact,
            timestep,
            filePath,
            summaryWriter
        );

        // If the transformer used writeSummaryChunk, we uploaded the stream
        if(summaryWriter.wroteAny){
            const res = await summaryWriter.finalizeAndUpload();
            if(res){
                this.recorder.recordUpload(SYS_BUCKETS.PLUGINS, res.storageKey);
            }
        }else if(summary !== null && summary !== undefined){
            // The transformer returned a manageable object in memory
            await this.saveSummary(artifact, timestep, summary);
        }

        if(artifact.exportConfig){
            const resultForExport = await this.loadResultForExport(filePath);
            await this.exportArtifactResults(artifact, timestep, resultForExport);
        }
    }

    private async loadResultForExport(filePath: string): Promise<any>{
        const ext = path.extname(filePath).toLowerCase();
        if(ext === '.json'){
            const content = await fsp.readFile(filePath, 'utf-8');
            return JSON.parse(content);
        }

        return await readMsgpackFile(filePath);
    }

    private async exportArtifactResults(artifact: Artifact, timestep: number, result: any){
        const { exportConfig } = artifact;
        if(!exportConfig) return;

        let { name, type, handler, opts } = exportConfig;
        if(exportConfig.type !== 'glb'){
            throw new Error(`[${this.pluginName} plugin]: the "${type}" (type is not yet supported (${artifact.id} artifact).`);
        }

        const exporter = this.getBuiltInExporter(name);
        if(!handler) handler = 'toGLBMinIO';

        // @ts-ignore
        if(typeof (exporter)[handler] !== 'function'){
            throw new Error(`[${this.pluginName} plugin]: the "${handler}" method is not available in ${name}.`);
        }

        const artifactKey = slugify(artifact.id || name || 'artifact');

        const objectName = `trajectory-${this.trajectoryId}/analysis-${this.analysisId}/glb/${timestep}/${artifactKey}.${type}`;
        // @ts-ignore
        await exporter[handler](result, objectName, opts);
    }

    private async saveRawResult(artifact: Artifact, timestep: number, filePath: string){
        const artifactKey = slugify(artifact.id);
        const storageKey = [
            'plugins',
            `trajectory-${this.trajectoryId}`,
            `analysis-${this.analysisId}`,
            artifactKey,
            `timestep-${timestep}.msgpack`
        ].join('/');

        const stream = fs.createReadStream(filePath);
        await putObject(storageKey, SYS_BUCKETS.PLUGINS, stream, {
            'Content-Type': 'application/msgpack'
        });
        this.recorder.recordUpload(SYS_BUCKETS.PLUGINS, storageKey);
    }

    private async saveSummary(artifact: Artifact, timestep: number, summary: any){
        const artifactKey = slugify(artifact.id);
        const storageKey = [
            'plugins',
            `trajectory-${this.trajectoryId}`,
            `analysis-${this.analysisId}`,
            artifactKey,
            `timestep-${timestep}.msgpack`
        ].join('/');

        const payload = {
            ...summary,
            trajectory: this.trajectoryId,
            analysis: this.analysisId,
            timestep
        };

        const buffer = encodeMsgpack(payload);
        await putObject(storageKey, SYS_BUCKETS.PLUGINS, buffer, {
            'Content-Type': 'application/msgpack'
        });
        this.recorder.recordUpload(SYS_BUCKETS.PLUGINS, storageKey);
    }

    private async applyTransformer(
        artifact: Artifact,
        timestep: number,
        filePath: string,
        summaryWriter: SummaryStreamWriter
    ): Promise<any | null>{
        const transformer = await this.loadTransformer(artifact);
        if(!transformer) return null;

        const ctx: ArtifactTransformContext = {
            pluginName: this.pluginName,
            trajectoryId: this.trajectoryId,
            analysisId: this.analysisId,
            timestep,
            artifact,
            filePath,
            iterateChunks: () => {
                if(!artifact.iterableKey){
                    throw new Error(`[${this.pluginName} plugin]: iterateChunks() is only allowed when "iterableKey" is defined for artifact "${artifact.id}".`);
                }
                return this.iterateIterableChunks(artifact, filePath);
            },
            readAllAsBuffer: () => fsp.readFile(filePath),
            writeChunk: (chunk: unknown) => summaryWriter.append(chunk)
        };

        return await transformer(ctx);
    }

    private async *iterateIterableChunks(
        artifact: Artifact,
        filePath: string
    ): AsyncIterable<Buffer>{
        const chunkSize = artifact.iterableChunkSize ?? 10_000;
        const opts = { iterableKey: artifact.iterableKey, chunkSize };
        for await(const slice of decodeArrayStreamFromFile(filePath, opts)){
            const json = JSON.stringify(slice);
            yield Buffer.from(json, 'utf-8');
        }
    }
    
    private async loadTransformer(artifact: Artifact): Promise<ArtifactTransformer | null>{
        const fileName = `${slugify(artifact.id)}.ts`;
        const fullPath = path.join(this.pluginsDir, this.pluginName, 'transformers', fileName);
        
        try{
            await fsp.access(fullPath);
        }catch{
            return null;
        }

        const mod = await import(fullPath);
        const func = mod.default as ArtifactTransformer | undefined;
        if(typeof func !== 'function'){
            throw new Error(`[${this.pluginName} plugin]: transformer for artifact "${artifact.id}" must export a default function.`);
        }
        return func;
    }

    private getBuiltInExporter(name: BuiltInExports){
        switch(name){
            case 'AtomisticExporter':
                return new AtomisticExporter();
            case 'DislocationExporter': 
                return new DislocationExporter();
            default:
                return new MeshExporter();
        }
    }
};