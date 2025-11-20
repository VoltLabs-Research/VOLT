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

import { initializeMinio } from '@/config/minio';
import { fileExists } from '@/utilities/fs';
import ArtifactProcessor from '@/services/plugins/artifact-processor';
import ManifestService from '@/services/plugins/manifest-service';
import AnalysisContext from '@/services/plugins/analysis-context';
import ArgumentsBuilder from '@/services/plugins/arguments-builder';
import CLIExec from '@/services/cli-exec';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

type ResultFiles = Record<string, any>;

export default class Plugin{
    private context: AnalysisContext;
    private manifest: ManifestService;
    private cli: CLIExec;

    constructor(
        private pluginName: string,
        private trajectoryId: string,
        private analysisId: string,
        private pluginsDir = process.env.PLUGINS_DIR || ''
    ){
        if(!pluginsDir){
            throw new Error('PLUGINS_DIR is not defined.');
        }

        this.pluginName = slugify(this.pluginName);
        this.context = new AnalysisContext(this.pluginName);
        this.manifest = new ManifestService(this.pluginsDir, this.pluginName);
        this.cli = new CLIExec();
    }

    private async getResultFiles(outputBase: string): Promise<{ results: ResultFiles, generatedFiles: string[] }>{
        const { artifacts } = await this.manifest.get();
        const results: ResultFiles = {};
        const generatedFiles: string[] = [];
        for(const { name, resultFile } of artifacts){
            const filePath = `${outputBase}_${resultFile}`;
            const exists = await fileExists(filePath);
            if(!exists) continue;

            console.log(`[${this.pluginName} plugin] reading file: ${filePath}`);
            results[name] = { filePath };
            generatedFiles.push(filePath);
        }

        // TODO: 
        return { results, generatedFiles };
    }

    private async buildArgs<T>(options: T): Promise<string[]>{
        const { entrypoint } = await this.manifest.get();
        const builder = new ArgumentsBuilder(entrypoint.args);
        return builder.build(options);
    }

    private getTimestepFromFilename(filename: string): number{
        const match = filename.match(/\d+/g);
        if(match){
            const timestepStr = match[match.length - 1];
            return parseInt(timestepStr, 10);
        }
        throw new Error(`Could not extract timestep from filename: ${filename}`);
    }

    async evaluate<T>(inputFile: string, options: T){
        try{
            const cpuIntensiveTasksEnabled = process.env.CPU_INTENSIVE_TASKS !== 'false';
            if(!cpuIntensiveTasksEnabled){
                throw new Error('CPUIntensiveTasks::Disabled');
            }

            const baseFilename = path.basename(inputFile);
            console.log(`[${this.pluginName} plugin]: starting processing for: ${baseFilename}`);

            const outputBase = path.join(os.tmpdir(), `opendxa-out-${Date.now()}-${baseFilename}`);
            const args = await this.buildArgs<T>(options);

            await this.execute(inputFile, outputBase, args);
            const { results, generatedFiles } = await this.getResultFiles(outputBase);
            const timestep = this.getTimestepFromFilename(inputFile);
            await this.process(results, timestep, options);
            await this.unlinkGeneratedFiles(generatedFiles);
        }catch(err){
            console.error(`[${this.pluginName} plugin] failed to process ${inputFile}:`, err);
            await this.context.rollback();
            throw err;
        }
    }

    private async process<T>(results: ResultFiles, timestep: number, options: T){
        const { artifacts } = await this.manifest.get();
        const processor = new ArtifactProcessor(
            this.pluginsDir,
            this.pluginName,
            this.trajectoryId,
            this.analysisId,
            this.context
        );

        for(const artifact of artifacts){
            const entry = results[artifact.id];
            if(!entry) continue;
            await processor.evaluate(artifact, timestep, entry.filePath);
        }
    }
    
    private async execute(inputFile: string, outputBase: string, opts: string[]){
        const { entrypoint } = await this.manifest.get();
        const args = [inputFile, outputBase, ...opts];
        const execPath = path.join(this.pluginsDir, this.pluginName, entrypoint.bin);
        await this.cli.run(execPath, args);
    }

    private async unlinkGeneratedFiles(generatedFiles: string[]){
        await Promise.all(generatedFiles.map((file) => {
            fs.unlink(file).catch((err) => {
                console.error(`Failed to delete file ${file}:`, err)
            });
        }));
    }
};

import { Analysis } from '@/models';
import { slugify } from '@/utilities/runtime';
import mongoConnector from '@/utilities/mongo/mongo-connector';
import '@/config/env';

(async () => {
    await mongoConnector();
    await initializeMinio();

    const analysis = await Analysis.create({
        plugin: 'opendxa',
        artifact: 'dislocation-analysis',
        trajectory: '691e9e0011679d6b65f602c4',
        config: {}
    });

    const plugin = new Plugin('base-tools', '691e9e0011679d6b65f602c4', analysis._id.toString());
    await plugin.evaluate('/home/rodyherrera/Desktop/OpenDXA/server/storage/trajectories/691e9e0011679d6b65f602c4/dumps/25000', {});
})();