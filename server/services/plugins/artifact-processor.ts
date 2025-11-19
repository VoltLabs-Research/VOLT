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

import { Analysis } from '@/models';
import { IAnalysis } from '@/models/analysis';
import { putObject } from '@/config/minio';
import DislocationExporter from '@/utilities/export/dislocations';
import MeshExporter from '@/utilities/export/mesh';
import AtomisticExporter from '@/utilities/export/atoms';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

type BuiltInExports = 'AtomisticExporter' | 'MeshExporter' | 'DislocationExporter';

export interface ArtifactExport {
    name: BuiltInExports;
    handler?: string;
    type: string;
    opts: any;
};

export interface Artifact{
    name: string;
    resultFile: string;
    exportConfig?: ArtifactExport;
};

export interface ExecutionRecorder{
    recordAnalysis(analysis: IAnalysis): void;
    recordUpload(bucket: string, key: string): void;
};

export default class ArtifactProcessor{
    constructor(
        private pluginName: string,
        private trajectoryId: string,
        private exportDirectory: string,
        private recorder: ExecutionRecorder
    ){}

    async evaluate<T>(
        artifact: Artifact,
        result: any,
        timestep: number,
        config: T
    ): Promise<void>{
        const analysis = await this.createAnalysis(config, timestep, artifact.name);
        await this.saveArtifactResults(analysis, artifact, timestep, result);
        await this.exportArtifactResults(artifact, timestep, result);
        await this.linkStorageKey(analysis, timestep);
    }

    private async linkStorageKey(analysis: IAnalysis, timestep: number){
        const storageKey = this.getStorageKey(analysis, timestep);
        await Analysis.updateOne({ _id: analysis._id }, { storageKey });
    }
    
    private async exportArtifactResults(artifact: Artifact, timestep: number, result: any){
        const { exportConfig } = artifact;
        if(!exportConfig) return;

        let { name, type, handler, opts } = exportConfig;
        if(exportConfig.type !== 'glb'){
            throw new Error(`[${this.pluginName} plugin]: the "${type}" (type is not yet supported (${artifact.name} artifact).`);
        }

        if(!handler) handler = 'toGLB';
        const exporter = this.getBuiltInExporter(name);
        //if(!Object.prototype.hasOwnProperty.call(exporter, handler)){
        //    throw new Error(`[${this.pluginName} plugin]: the "${handler}" method is not yet supported.`);
        //}

        const outputPath = await this.getExportOutputPath(timestep, type, name);
        // @ts-ignore
        await exporter[handler](result, outputPath, opts);
    }
        
    private async saveArtifactResults(analysis: IAnalysis, artifact: Artifact, timestep: number, result: any){
        const bucketName = this.getArtifactBucket(artifact);
        const storageKey = this.getStorageKey(analysis, timestep);
        await putObject(bucketName, storageKey, result);
        this.recorder.recordUpload(bucketName, storageKey);
    }
    
    private async createAnalysis<T>(config: T, timestep: number, artifact: string){
        const analysis = await Analysis.create({
            config,
            timestep,
            plugin: this.pluginName,
            artifact: artifact.replace(' ', '-'),
            trajectory: this.trajectoryId
        });

        this.recorder.recordAnalysis(analysis);
        return analysis;
    }

    private getArtifactBucket(artifact: Artifact){
        return `${this.pluginName.toLowerCase()}-${artifact.name.replace(' ', '-')}`;
    }

    private getStorageKey(analysis: IAnalysis, timestep: number){
        return `${this.trajectoryId}/${analysis!._id}/${timestep}.json`;
    }
    
    private async getExportOutputPath(timestep: number, type: string, exportName: string): Promise<string>{
        const dir = path.join(this.exportDirectory, String(timestep));
        await fs.mkdir(dir, { recursive: true });
        return path.join(dir, `${exportName}.${type}`);
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