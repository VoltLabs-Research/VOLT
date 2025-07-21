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

import MeshExporter, { Mesh } from '@utilities/export/mesh';
import DislocationExporter, { Dislocation } from '@utilities/export/dislocations';
import opendxa from '../../bindings/nodejs';
import LAMMPSToGLTFExporter, { AtomsData } from '@utilities/export/atoms';
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

/**
 * Provides a high-level service to interact with the OpenDXA C++ binding.
 * It manages configuration, orchestrates the analysis of simulation trajectories,
 * and handles the exportation of results into GLTF format. 
*/
class OpenDXAService{
    private exportDirectory: string;

    constructor(trajectoryFolderPath: string){
        // The user could have configuration profiles in the database.
        // Here, they could be retrieved and loaded. However, OpenDXA from C++ already sets the default configuration.
        this.exportDirectory = path.join(trajectoryFolderPath, 'gltf');
    }

    /**
     * Configures the global OpenDXA analyzer with the provided parameters.
     * It iterates through a map of known settings and applies them if they are present in the config object.
     * @param {ConfigParameters} config - An object containing the configuration parameters to apply.
    */
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

    /**
     * Constructs a standardized output file path for a given frame and export type.
     * @private
     * @param frame - The timestep or frame number of the simulation. 
     * @param exportName - A descriptive name for the exported artifact (e.g, 'defect_mesh').
     * @returns {string} The full, absolute path for the output GLTF file.
    */
    private getOutputPath(frame: number, exportName: string){
        return path.join(this.exportDirectory, `frame_${frame}_${exportName}.gltf`)
    }

    /**
     * Exports the atomic data of a frame to a GLTF file, with atoms colored by their type.
     * @private
     * @param {AtomsData} atoms - The atomic data structure from the analysis result. 
     * @param {number} frame - The current simulation frame number (timestep).
    */
    private exportAtomsColoredByType(atoms: AtomsData, frame: number){
        const exporter = new LAMMPSToGLTFExporter();
        const outputPath = this.getOutputPath(frame, 'atoms_colored_by_type');
        exporter.exportAtomsTypeToGLTF(atoms, outputPath);
    }

    /**
     * Exports dislocation line data to GLTF file using predefined visualization settings.
     * @private
     * @param {Dislocation} dislocation - The dislocation data from the analysis result.
     * @param {number} frame - The current simulation frame number (timestep).
    */
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

    /**
     * Exports a mesh structure (either a defect or interface mesh) to a GLTF file.
     * @private
     * @param {Mesh} mesh - The mesh data structure from the analysis result. 
     * @param {number} frame - The current simulation frame number (timestep).
     * @param {'defect' | 'interface'} [meshType='defect'] - The type of mesh being exported, used for naming the ouput file.
    */
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

    /**
     * Callback function that is executed by the native addon for each completed frame in the trajectory analysis.
     * It destructures the analysis result and orchestrates the exportation of all relevant data.
     * @private
     * @param {ProgressInfo} progress  The progress object from the C++ binding, containing the analysis results for the current frame.
    */
    private progressCallback(progress: ProgressInfo){
        const frameResult = progress.frameResult!;
        const { interface_mesh, defect_mesh, dislocations, atoms } = frameResult;
        const { timestep } = frameResult.metadata;

        this.exportMesh(defect_mesh, timestep, 'defect');
        this.exportMesh(interface_mesh, timestep, 'interface');
        
        this.exportDislocations(dislocations, timestep);

        this.exportAtomsColoredByType(atoms, timestep);
    }

    /**
     * Starts the asynchronous analysis of a sequence of simulation files.
     * It sets up the progress callback and initiates the computation in the C++ addon.
     * @param {string[]} inputFiles - An array of file paths for the simulation frames to be analyzed.
     * @returns {Promise<any>} A promise that resolves with the final summary result from the C++ binding when the entire trajectory has been processed.
    */
    public async analyzeTrajectory(inputFiles: string[]){
        opendxa.setProgressCallback(this.progressCallback.bind(this));

        return new Promise((resolve) => {
            console.log(`Starting OpenDXA analysis for ${inputFiles.length} files...`);
            opendxa.computeTrajectory(inputFiles, undefined, resolve);
        });
    }
};

export default OpenDXAService;