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

import MeshExporter, { Mesh } from '@utilities/defectMeshGltfExporter';
import DislocationExporter, { Dislocation } from '@utilities/dislocationGltfExporter';
import opendxa from '../../bindings/nodejs';
import LAMMPSToGLTFExporter, { AtomsData } from '@utilities/lammpsGltfExporter';
import { ConfigParameters, ProgressInfo } from '../../bindings/nodejs/types';
import path from 'path';

export enum LatticeStructure {
    FCC = 1,
    HCP = 2,
    BCC = 3,
    CUBIC_DIAMOND = 4,
    HEX_DIAMOND = 5
}

export enum IdentificationMode {
    CNA = 0,
    PTM = 1
}

type OpenDXASetterMap = {
    [K in keyof ConfigParameters]?: (value: NonNullable<ConfigParameters[K]>) => void;
}

const configSetterMap: OpenDXASetterMap = {
    crystalStructure: opendxa.setCrystalStructure,
    maxTrialCircuitSize: opendxa.setMaxTrialCircuitSize,
    circuitStretchability: opendxa.setCircuitStretchability,
    onlyPerfectDislocations: opendxa.setOnlyPerfectDislocations,
    markCoreAtoms: opendxa.setMarkCoreAtoms,
    lineSmoothingLevel: opendxa.setLineSmoothingLevel,
    linePointInterval: opendxa.setLinePointInterval,
    identificationMode: opendxa.setIdentificationMode,
};

class OpenDXAService{
    private exportDirectory: string;
    private analysisOutputTemplate: string;

    constructor(trajectoryFolderPath: string, trajectoryAnalysisPath: string){
        // The user could have configuration profiles in the database.
        // Here, they could be retrieved and loaded. However, OpenDXA from C++ already sets the default configuration.
        this.analysisOutputTemplate = path.join(trajectoryAnalysisPath, 'frame_{}');
        this.exportDirectory = path.join(trajectoryFolderPath, 'gltf');
    }

    configure(config: ConfigParameters){
        for(const key in configSetterMap){
            const configKey = key as keyof ConfigParameters;
            const value = config[configKey];
            if(value !== undefined && value !== null){
                const setter = configSetterMap[configKey] as (v: any) => void;
                if(setter) setter(value);
            }
        }
        opendxa.setCrystalStructure(LatticeStructure.BCC);
        opendxa.setIdentificationMode(IdentificationMode.PTM);
    }

    private getOutputPath(frame: number, exportName: string){
        return path.join(this.exportDirectory, `frame_${frame}_${exportName}.gltf`)
    }

    private exportAtomsColoredByType(atoms: AtomsData, frame: number){
        const exporter = new LAMMPSToGLTFExporter();
        const outputPath = this.getOutputPath(frame, 'atoms_colored_by_type');
        exporter.exportAtomsTypeToGLTF(atoms, outputPath);
    }

    private exportDislocations(dislocation: Dislocation, frame: number){
        const exporter = new DislocationExporter();
        const outputPath = this.getOutputPath(frame, 'dislocations');
        exporter.toGLTF(dislocation, outputPath, {
            lineWidth: 0.3,
            colorByType: true,
            material: {
                baseColor: [1.0, 0.5, 0.0, 1.0],
                metallic: 0.0,
                roughness: 0.8
            }
        });
    }

    private exportMesh(mesh: Mesh, frame: number, meshType: 'defect' | 'interface' = 'defect'){
        const exporter = new MeshExporter();
        const outputPath = this.getOutputPath(frame, `${meshType}_mesh`);
        exporter.toGLTF(mesh, outputPath, {
            material: {
                baseColor: [1.0, 1.0, 1.0, 1.0],
                metallic: 0.0,
                roughness: 0.0,
                emissive: [0.0, 0.0, 0.0]
            },
            metadata: { includeOriginalStats: true }
        });
    }

    private progressCallback(progress: ProgressInfo){
        const frameResult = progress.frameResult!;
        const { interface_mesh, defect_mesh, dislocations, atoms } = frameResult;
        const { timestep } = frameResult.metadata;

        this.exportMesh(defect_mesh, timestep, 'defect');
        this.exportMesh(interface_mesh, timestep, 'interface');
        
        this.exportDislocations(dislocations, timestep);
        
        this.exportAtomsColoredByType(atoms, timestep);
    }

    async analyzeTrajectory(inputFiles: string[]){
        opendxa.setProgressCallback(this.progressCallback.bind(this));

        return new Promise((resolve) => {
            console.log(`Starting OpenDXA analysis for ${inputFiles.length} files...`);
            opendxa.computeTrajectory(inputFiles, this.analysisOutputTemplate, resolve);
        });
    }
};

export default OpenDXAService;