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

import MeshExporter from '@utilities/defectMeshGltfExporter';
import opendxa from '../../bindings/nodejs';
import type { ConfigParameters, ProgressInfo, } from '../../bindings/nodejs/types/index.js';
import path from 'path';

class OpenDXAService{
    private outputTemplate: string;

    constructor(outputTemplate: string){
        // The user could have configuration profiles in the database.
        // Here, they could be retrieved and loaded. However, OpenDXA from C++ already sets the default configuration.
        this.outputTemplate = outputTemplate;
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

        opendxa.setCrystalStructure(1);
        opendxa.setIdentificationMode(1);
    }

    private progressCallback(progress: ProgressInfo){
        const frameResult = progress.frameResult!;
        const defectMesh = frameResult.defect_mesh;

        if(!defectMesh.data || defectMesh.data.facets.length === 0){
            console.log(`[Frame ${frameResult.metadata.timestep}] No defect mesh with facets to export. Skipping.`);
            return;
        }

        const outputDir = path.dirname(this.outputTemplate);
        const baseName = path.basename(this.outputTemplate, path.extname(this.outputTemplate));
        const timestep = frameResult.metadata.timestep;
        const defectMeshOutputPath = path.join(outputDir, `${baseName.replace('{}', timestep)}_defect_mesh.gltf`);

        try{
            const defectMeshExporter = new MeshExporter();
            defectMeshExporter.exportToGLTF(defectMesh, defectMeshOutputPath, {
                material: {
                    baseColor: [1.0, 0.5, 0.2, 1.0],
                    metallic: 0.2,
                    roughness: 0.6
                },
                metadata: { includeOriginalStats: true }
            });
        }catch(error){
            console.error(`[Frame ${timestep}] Error exporting defect mesh to GLTF:`, error);
        }
    }

    async analyzeTrajectory(inputFiles: string[]){
        opendxa.setProgressCallback(this.progressCallback.bind(this));

        return new Promise((resolve, reject) => {
            console.log(`Starting OpenDXA analysis for ${inputFiles.length} files...`);
            opendxa.computeTrajectory(inputFiles, this.outputTemplate, (result: any) => {
                resolve(result);
            });
        });
    }
};

export default OpenDXAService;