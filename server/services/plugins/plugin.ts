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

import { fileExists } from '@/utilities/fs';
import { slugify } from '@/utilities/runtime';
import ArtifactProcessor from '@/services/plugins/modifier-processor';
import ManifestService from '@/services/plugins/manifest-service';
import AnalysisContext from '@/services/plugins/modifier-context';
import ArgumentsBuilder from '@/services/plugins/arguments-builder';
import CLIExec from '@/services/cli-exec';
import TrajectoryVFS from '@/services/trajectory-vfs';
import DumpStorage from '@/services/dump-storage';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import logger from '@/logger';

type ResultFiles = Record<string, any>;

export default class Plugin {
    private context: AnalysisContext;
    private manifest: ManifestService;
    private cli: CLIExec;

    constructor(
        private pluginName: string,
        private trajectoryId: string,
        private analysisId: string,
        private pluginsDir = process.env.PLUGINS_DIR || ''
    ) {
        if (!pluginsDir) {
            throw new Error('PLUGINS_DIR is not defined.');
        }

        this.pluginName = slugify(this.pluginName);
        this.context = new AnalysisContext(this.pluginName);
        this.manifest = new ManifestService(this.pluginName, this.pluginsDir);
        this.cli = new CLIExec();
    }

    private async getResultFiles(outputBase: string, modifierId: string): Promise<{ results: ResultFiles, generatedFiles: string[] }> {
        const { modifiers } = await this.manifest.get();
        const { exposure } = modifiers[modifierId];
        const results: ResultFiles = {};
        const generatedFiles: string[] = [];
        for (const [exposureId, config] of Object.entries(exposure)) {
            const filePath = `${outputBase}_${config.results}`;
            const exists = await fileExists(filePath);
            if (!exists) continue;

            logger.info(`[${this.pluginName} plugin] reading file: ${filePath}`);
            results[exposureId] = filePath;
            generatedFiles.push(filePath);
        }

        return { results, generatedFiles };
    }

    private async buildArgs<T>(options: any): Promise<string[]> {
        const { entrypoint } = await this.manifest.get();

        // Pre-process options to resolve trajectory-frame arguments
        const processedOptions = { ...options };
        if (entrypoint.arguments) {
            for (const [key, argDef] of Object.entries(entrypoint.arguments)) {
                if (argDef.type === 'trajectory-frame' && options[key] !== undefined) {
                    const timestep = Number(options[key]);
                    if (!isNaN(timestep)) {
                        const dumpFile = await DumpStorage.getDump(this.trajectoryId, timestep);
                        if (dumpFile) {
                            processedOptions[key] = dumpFile;
                        } else {
                            logger.warn(`[${this.pluginName}] Could not find dump file for timestep ${timestep}`);
                        }
                    }
                }
            }
        }

        const builder = new ArgumentsBuilder(entrypoint.arguments);
        return builder.build(processedOptions);
    }

    private getTimestepFromFilename(filename: string): number {
        const match = filename.match(/\d+/g);
        if (match) {
            const timestepStr = match[match.length - 1];
            return parseInt(timestepStr, 10);
        }
        throw new Error(`Could not extract timestep from filename: ${filename}`);
    }

    async evaluate<T>(inputFile: string, modifierId: string, options: T) {
        try {
            const cpuIntensiveTasksEnabled = process.env.CPU_INTENSIVE_TASKS !== 'false';
            if (!cpuIntensiveTasksEnabled) {
                throw new Error('CPUIntensiveTasks::Disabled');
            }

            const baseFilename = path.basename(inputFile);
            logger.info(`[${this.pluginName} plugin]: starting ${modifierId} processing for: ${baseFilename}`);

            const outputBase = path.join(os.tmpdir(), `opendxa-out-${Date.now()}-${baseFilename}`);
            const args = await this.buildArgs<T>(options);

            await this.execute(inputFile, outputBase, args);
            const { results, generatedFiles } = await this.getResultFiles(outputBase, modifierId);
            const timestep = this.getTimestepFromFilename(inputFile);
            await this.process(results, timestep, modifierId);
            await this.unlinkGeneratedFiles(generatedFiles);
        } catch (err) {
            logger.error(`[${this.pluginName} plugin] failed to process ${inputFile}: ${err}`);
            await this.context.rollback();
            throw err;
        }
    }

    async process(results: ResultFiles, timestep: number, modifierId: string) {
        const { modifiers } = await this.manifest.get();
        const modifier = modifiers[modifierId];
        const processor = new ArtifactProcessor(
            modifierId,
            modifier,
            this.pluginsDir,
            this.pluginName,
            this.trajectoryId,
            this.analysisId,
            this.context
        );

        for (const exposureId of Object.keys(modifier.exposure)) {
            const resultsPath = results[exposureId];
            if (!resultsPath) {
                logger.warn(`[${this.pluginName} plugin] skipping exposure "${exposureId}" for modifier "${modifierId}" – missing results file.`);
                continue;
            }
            await processor.evaluate(exposureId, timestep, resultsPath);
        }
    }

    private async execute(inputFile: string, outputBase: string, opts: string[]) {
        const { entrypoint } = await this.manifest.get();
        const args = [inputFile, outputBase, ...opts];
        const execPath = path.join(this.pluginsDir, this.pluginName, entrypoint.bin);
        await this.cli.run(execPath, args);
    }

    private async unlinkGeneratedFiles(generatedFiles: string[]) {
        await Promise.all(generatedFiles.map((file) => {
            fs.unlink(file).catch((err) => {
                logger.error(`Failed to delete file ${file}: ${err}`)
            });
        }));
    }
};
