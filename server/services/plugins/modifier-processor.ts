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
import { BuiltInExports, Modifier, ModifierTransformContext, ModifierTransformer } from '@/types/services/plugin';

export interface ExecutionRecorder{
    recordUpload(bucket: string, key: string): void;
};

export default class ArtifactProcessor{
    constructor(
        private modifierId: string,
        private modifier: Modifier,
        private pluginsDir: string,
        private pluginName: string,
        private trajectoryId: string,
        private analysisId: string,
        private recorder: ExecutionRecorder
    ){}

    async evaluate(exposureId: string, timestep: number, filePath: string): Promise<void>{
        await this.saveRawResult(exposureId, timestep, filePath);

        const summaryWriter = new SummaryStreamWriter(
            this.pluginName,
            this.trajectoryId,
            this.analysisId,
            exposureId,
            timestep
        );

        const summary = await this.applyTransformer(
            exposureId,
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
            await this.saveSummary(exposureId, timestep, summary);
        }

        if(this.modifier.exposure[exposureId].export){
            const resultForExport = await this.loadResultForExport(filePath);
            await this.exportArtifactResults(exposureId, timestep, resultForExport);
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

    private async exportArtifactResults(exposureId: any, timestep: number, result: any){
        const exportConfig = this.modifier.exposure[exposureId].export;
        if(!exportConfig) return;

        let { name, type, handler, options } = exportConfig;
        if(exportConfig.type !== 'glb'){
            throw new Error(`[${this.pluginName} plugin]: the "${type}" (type is not yet supported (${this.modifierId} modifier).`);
        }

        const exporter = this.getBuiltInExporter(name);
        if(!handler) handler = 'toGLBMinIO';

        // @ts-ignore
        if(typeof (exporter)[handler] !== 'function'){
            throw new Error(`[${this.pluginName} plugin]: the "${handler}" method is not available in ${name}.`);
        }

        const objectName = `trajectory-${this.trajectoryId}/analysis-${this.analysisId}/glb/${timestep}/${exposureId}.${type}`;
        // @ts-ignore
        await exporter[handler](result, objectName, options);
    }

    private async saveRawResult(exposureId: any, timestep: number, filePath: string){
        const outputKey = slugify(exposureId);
        const storageKey = [
            'plugins',
            `trajectory-${this.trajectoryId}`,
            `analysis-${this.analysisId}`,
            exposureId,
            `timestep-${timestep}.msgpack`
        ].join('/');

        const stream = fs.createReadStream(filePath);
        await putObject(storageKey, SYS_BUCKETS.PLUGINS, stream, {
            'Content-Type': 'application/msgpack'
        });
        this.recorder.recordUpload(SYS_BUCKETS.PLUGINS, storageKey);
    }

    private async saveSummary(exposureId: any, timestep: number, summary: any){
        const outputKey = slugify(exposureId);
        const storageKey = [
            'plugins',
            `trajectory-${this.trajectoryId}`,
            `analysis-${this.analysisId}`,
            outputKey,
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
        exposureId: string,
        timestep: number,
        filePath: string,
        summaryWriter: SummaryStreamWriter
    ): Promise<any | null>{
        const transformer = await this.loadTransformer(exposureId);
        const exposure = this.modifier.exposure[exposureId];
        if(!transformer) return null;
        
        const ctx: ModifierTransformContext = {
            pluginName: this.pluginName,
            trajectoryId: this.trajectoryId,
            analysisId: this.analysisId,
            modifier: this.modifier,
            timestep,
            exposureId,
            exposure,
            filePath,
            iterateChunks: () => {
                if(!exposure.iterable){
                    throw new Error(`[${this.pluginName} plugin]: iterateChunks() is only allowed when "iterable" is defined for modifier "${exposureId}".`);
                }
                return this.iterateIterableChunks(exposureId, filePath);
            },
            readAllAsBuffer: () => fsp.readFile(filePath),
            writeChunk: (chunk: unknown) => summaryWriter.append(chunk)
        };

        return await transformer(ctx);
    }

    private async *iterateIterableChunks(
        exposureId: string,
        filePath: string
    ): AsyncIterable<Buffer>{
        const { iterableChunkSize, iterable } = this.modifier.exposure[exposureId];
        const chunkSize = iterableChunkSize ?? 10_000;
        const opts = { iterableKey: iterable, chunkSize };
        for await(const slice of decodeArrayStreamFromFile(filePath, opts)){
            const json = JSON.stringify(slice);
            yield Buffer.from(json, 'utf-8');
        }
    }
    
    private async loadTransformer(exposureId: string): Promise<ModifierTransformer | null>{
        const fileName = `${slugify(exposureId)}.ts`;
        const fullPath = path.join(this.pluginsDir, this.pluginName, 'transformers', fileName);
        
        try{
            await fsp.access(fullPath);
        }catch{
            return null;
        }

        const mod = await import(fullPath);
        const func = mod.default as ModifierTransformer | undefined;
        if(typeof func !== 'function'){
            throw new Error(`[${this.pluginName} plugin]: transformer for modifier "${exposureId}" must export a default function.`);
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