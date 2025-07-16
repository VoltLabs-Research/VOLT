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

import opendxa from '../../bindings/nodejs/index.mjs';
import CompressionService from '@services/compression';
import { join } from 'path';
import type { 
    ConfigParameters,
    ProgressInfo,
    TrajectoryCallback
} from '../../bindings/nodejs/types/index.d.ts';
import { existsSync } from 'fs';

class OpenDXAService{
    private compressionService = new CompressionService();

    constructor(){
        // The user could have configuration profiles in the database.
        // Here, they could be retrieved and loaded. However, OpenDXA from C++ already sets the default configuration.
    }

    configure(config: ConfigParameters){
        if(config.crystalStructure){
            opendxa.setCrystalStructure(config.crystalStructure);
        }

        if(config.maxTrialCircuitSize){
            opendxa.setMaxTrialCircuitSize(config.maxTrialCircuitSize);
        }

        if(config.circuitStretchability){
            opendxa.setCircuitStretchability(config.circuitStretchability);
        }

        if(config.onlyPerfectDislocations){
            opendxa.setOnlyPerfectDislocations(config.onlyPerfectDislocations);
        }

        if(config.markCoreAtoms){
            opendxa.setMarkCoreAtoms(config.markCoreAtoms);
        }

        if(config.lineSmoothingLevel){
            opendxa.setLineSmoothingLevel(config.lineSmoothingLevel);
        }

        if(config.linePointInterval){
            opendxa.setLinePointInterval(config.linePointInterval);
        }

        if(config.identificationMode){
            opendxa.setIdentificationMode(config.identificationMode);
        }
    }

    async analyzeTrajectory(inputFiles: string[], outputTemplate: string, folderId: string){
        return new Promise((resolve, reject) => {
            const compressionWorkers: Promise<any>[] = [];

            opendxa.setProgressCallback((progress: ProgressInfo) => {
                // TODO: fix types
                const outputFile = progress.frameResult.output_file;
                if(!progress.frameResult.is_failed && existsSync(outputFile)){
                    const compressedDir = join(process.env.ANALYSIS_DIR as string, folderId);
                    const compressionPromise = this.compressionService.compress(outputFile, compressedDir);
                    compressionWorkers.push(compressionPromise);
                }
            });

            opendxa.computeTrajectory(inputFiles, outputTemplate, async () => {
                console.log(`Waiting for ${compressionWorkers.length} compression tasks...`);
                const compressionResults = await Promise.all(compressionWorkers);
                const failedCompressions = compressionResults.filter((result) => !result.success).length;
                const successfulCompressions = compressionResults.filter((result) => result.success).length;
                console.log(`Compression completed. Success: ${successfulCompressions}, Failed: ${failedCompressions}`);
                resolve(compressionResults);
            });
        });
    }
};

export default OpenDXAService;