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

import { putObject } from '@/config/minio';
import { slugify } from '@/utilities/runtime';
import DislocationExporter from '@/utilities/export/dislocations';
import MeshExporter from '@/utilities/export/mesh';
import AtomisticExporter from '@/utilities/export/atoms';

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
    recordUpload(bucket: string, key: string): void;
};

export default class ArtifactProcessor{
    constructor(
        private pluginName: string,
        private trajectoryId: string,
        private analysisId: string,
        private recorder: ExecutionRecorder
    ){}

    async evaluate<T>(artifact: Artifact, result: any, timestep: number): Promise<void>{
        await this.saveArtifactResults(artifact, timestep, result);
        await this.exportArtifactResults(artifact, timestep, result);
    }

    private async exportArtifactResults(artifact: Artifact, timestep: number, result: any){
        const { exportConfig } = artifact;
        if(!exportConfig) return;

        let { name, type, handler, opts } = exportConfig;
        if(exportConfig.type !== 'glb'){
            throw new Error(`[${this.pluginName} plugin]: the "${type}" (type is not yet supported (${artifact.name} artifact).`);
        }

        const exporter = this.getBuiltInExporter(name);
        if(!handler) handler = 'toGLBMinIO';

        // @ts-ignore
        if(typeof (exporter)[handler] !== 'function'){
            throw new Error(`[${this.pluginName} plugin]: the "${handler}" method is not available in ${name}.`);
        }

        const artifactKey = slugify(artifact.name || name || 'artifact');

        // {trajectoryId}/{analysisId}/glb/{timestep}/{artifactKey}.glb
        const objectName = `${this.trajectoryId}/${this.analysisId}/glb/${timestep}/${artifactKey}.${type}`;
        // @ts-ignore
        await exporter[handler](result, objectName, opts);
    }

    private async saveArtifactResults(artifact: Artifact, timestep: number, result: any){
        const bucketName = this.getArtifactBucket(artifact);
        const storageKey = `${this.trajectoryId}/${this.analysisId}/${timestep}.json`;
        const payload = {
            ...result,
            trajectory: this.trajectoryId,
            analysis: this.analysisId
        };
        await putObject(bucketName, storageKey, payload);
        this.recorder.recordUpload(bucketName, storageKey);
    }

    private getArtifactBucket(artifact: Artifact){
        const artifactKey = slugify(artifact.name);
        return `${this.pluginName.toLowerCase()}-${artifactKey}`;
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