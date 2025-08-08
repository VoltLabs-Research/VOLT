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

import { StructureAnalysisData, ConfigParameters } from '@/types/services/opendxa';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { Mesh } from '@/types/utilities/export/mesh';
import { Dislocation } from '@/types/utilities/export/dislocations';
import { AtomsGroupedByType } from '@/types/utilities/export/atoms';
import { readMsgpackFile } from '@/utilities/msgpack';
import path from 'path';
import os from 'os';
import MeshExporter from '@utilities/export/mesh';
import DislocationExporter from '@utilities/export/dislocations';
import LAMMPSToGLBExporter from '@utilities/export/atoms';
import StructureAnalysis from '@/models/structure-analysis';
import SimulationCell from '@/models/simulation-cell';
import Dislocations from '@models/dislocations';
import Trajectory from '@/models/trajectory';

const CLI_EXECUTABLE_PATH = path.resolve(__dirname, '../../opendxa/build/opendxa');

const MSGPACK_OUTPUT_MAP = {
    defect_mesh: '_defect_mesh.msgpack',
    atoms: '_atoms.msgpack',
    dislocations: '_dislocations.msgpack',
    interface_mesh: '_interface_mesh.msgpack',
    structures: '_structures_stats.msgpack',
    simulation_cell: '_simulation_cell.msgpack',
};

function parseTimestepFromFilename(filename: string): number {
    const match = filename.match(/\d+/g);
    if(match){
        const timestepStr = match[match.length - 1];
        return parseInt(timestepStr, 10);
    }
    throw new Error(`Could not extract timestep from filename: ${filename}`);
}

function buildCliArgs(options: ConfigParameters): string[] {
    const args: string[] = [];
    const optionMap: { [key in keyof ConfigParameters]: string } = {
        crystalStructure: '--crystalStructure',
        maxTrialCircuitSize: '--maxTrialCircuitSize',
        circuitStretchability: '--circuitStretchability',
        onlyPerfectDislocations: '--onlyPerfectDislocations',
        identificationMode: '--identificationMode',
        lineSmoothingLevel: '--lineSmoothingLevel',
        linePointInterval: '--linePointInterval',
        markCoreAtoms: '--markCoreAtoms',
    };

    for(const key in options){
        if(Object.prototype.hasOwnProperty.call(options, key)){
            // @ts-ignore
            const cliFlag = optionMap[key];
            const value = options[key as keyof ConfigParameters];
            if(cliFlag && value !== undefined && value !== null){
                args.push(cliFlag, String(value));
            }
        }
    }

    return args;
}

class OpenDXAService{
    private trajectoryId: string;
    private exportDirectory: string;

    constructor(trajectoryId: string, trajectoryFolderPath: string){
        this.exportDirectory = path.join(trajectoryFolderPath, 'glb');
        this.trajectoryId = trajectoryId;
    }

    public async processSingleFile(inputFile: string, options: ConfigParameters): Promise<any> {
        const baseFilename = path.basename(inputFile);
        console.log(`[OpenDXAService] Starting processing for: ${baseFilename}`);

        const outputBase = path.join(os.tmpdir(), `opendxa-out-${this.trajectoryId}-${Date.now()}-${baseFilename}`);
        const cliOptions = buildCliArgs(options);

        try{
            await this.runCliProcess(inputFile, outputBase, cliOptions);
            const { frameResult, generatedFiles } = await this.readOutputFiles(outputBase);

            const timestep = parseTimestepFromFilename(inputFile);
            frameResult.metadata = { timestep };

            console.log(`[OpenDXAService] Processing data for timestep ${timestep}`);
            await this.processFrameData(frameResult, timestep);

            console.log(`[OpenDXAService] Cleaning up temporary files for ${baseFilename}`);
            await Promise.all(generatedFiles.map(file =>
                fs.unlink(file).catch(err =>
                    console.error(`Failed to delete file ${file}:`, err)
                )
            ));

            console.log(`[OpenDXAService] Finished processing: ${baseFilename}`);
        }catch(error){
            console.error(`[OpenDXAService] Failed to process ${inputFile}:`, error);

            throw error;
        }
    }

    private runCliProcess(inputFile: string, outputBase: string, optionsArgs: string[]): Promise<void> {
        return new Promise((resolve, reject) => {
            const args = [inputFile, outputBase, ...optionsArgs];
            console.log(`[OpenDXAService] Running CLI with arguments: ${args.join(' ')}`);

            const cliProcess = spawn(CLI_EXECUTABLE_PATH, args);

            let stderrOutput = '';
            cliProcess.stdout.on('data', (data) => {
                console.log(`[OpenDXA CLI]: ${data.toString().trim()}`);
            });

            cliProcess.stderr.on('data', (data) => {
                const message = data.toString().trim();
                console.error(`[OpenDXA CLI ERROR]: ${message}`);
                stderrOutput += message + '\n';
            });

            cliProcess.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    const errorMessage = `OpenDXA CLI process exited with code ${code}.\nError log:\n${stderrOutput}`;
                    reject(new Error(errorMessage));
                }
            });

            cliProcess.on('error', (err) => {
                reject(new Error(`Failed to start OpenDXA CLI process: ${err.message}`));
            });
        });
    }

    private async readOutputFiles(outputBase: string): Promise<{ frameResult: any, generatedFiles: string[] }> {
        const frameResult: any = {};
        const generatedFiles: string[] = [];

        for(const [key, suffix] of Object.entries(MSGPACK_OUTPUT_MAP)){
            const filePath = outputBase + suffix;

            try{
                frameResult[key] = await readMsgpackFile(filePath);
                generatedFiles.push(filePath);

                console.log(`[OpenDXAService] Successfully read ${key} from ${path.basename(filePath)}`);
            }catch(readError: any){
                console.error(`Failed to read or decode ${filePath}:`, readError.message);
                try{
                    const stats = await fs.stat(filePath);
                    console.error(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
                }catch(statError){
                    // @ts-ignore
                    console.error(`Could not get file stats: ${statError.message}`);
                }

                throw new Error(`Could not process output file ${filePath}: ${readError.message}`);
            }
        }
        return { frameResult, generatedFiles };
    }
    
    private async processFrameData(frameResult: any, timestep: number): Promise<void> {
        const { interface_mesh, defect_mesh, dislocations, atoms, structures, simulation_cell } = frameResult;

        await Promise.all([
            this.exportMesh(defect_mesh, timestep, 'defect'),
            this.exportMesh(interface_mesh, timestep, 'interface'),
            this.exportDislocations(dislocations, timestep),
            this.exportAtomsColoredByType(atoms, timestep),
            this.handleStructuralData(structures, timestep),
            this.handleSimulationCellData(simulation_cell, timestep),
            this.handleDislocationData(dislocations, timestep)
        ]);
    }

    private async handleDislocationData(data: Dislocation, timestep: number): Promise<void>{
        const filter = {
            trajectory: this.trajectoryId,
            timestep
        };

        const updateData = {
            totalSegments: data.metadata.count,
            dislocations: data.data.map((dislocation) => ({
                segmentId: dislocation.segment_id,
                type: dislocation.type,
                pointIndexOffset: dislocation.point_index_offset,
                numPoints: dislocation.num_points,
                length: dislocation.length,
                points: dislocation.points,
                burgers: dislocation.burgers,
                nodes: dislocation.nodes,
                lineDirection: {
                    string: dislocation.line_direction?.string,
                    vector: dislocation.line_direction?.vector.map(v => isNaN(v) ? null : v)
                }
            })),
            totalPoints: data.summary.total_points,
            averageSegmentLength: data.summary.average_segment_length,
            maxSegmentLength: data.summary.max_segment_length,
            minSegmentLength: data.summary.min_segment_length,
            totalLength: data.summary.total_length,
            trajectory: this.trajectoryId,
            timestep
        };

        try{
            const dislocationDoc = await Dislocations.findOneAndUpdate(filter, updateData, {
                upsert: true,
                new: true,
                runValidators: true
            });
 
            await Trajectory.findByIdAndUpdate(this.trajectoryId, {
                $addToSet: { dislocations: dislocationDoc._id }
            });
        }catch(err){
            console.error(`[OpenDXAService] Failed to save dislocation data for timestep ${timestep}:`, err);
        }
    }

    private getOutputPath(frame: number, exportName: string): string {
        return path.join(this.exportDirectory, `frame_${frame}_${exportName}.glb`)
    }

    private exportAtomsColoredByType(groupedAtoms: AtomsGroupedByType, frame: number): void {
        const exporter = new LAMMPSToGLBExporter();
        const outputPath = this.getOutputPath(frame, 'atoms_colored_by_type');
        exporter.exportAtomsTypeToGLB(groupedAtoms, outputPath);
    }

    private exportDislocations(dislocation: Dislocation, frame: number): void {
        const exporter = new DislocationExporter();
        const outputPath = this.getOutputPath(frame, 'dislocations');
        exporter.toGLB(dislocation, outputPath, {
            lineWidth: 0.8,
            colorByType: true,
            material: {
                baseColor: [1.0, 0.5, 0.0, 1.0],
                metallic: 0.0,
                roughness: 0.8
            }
        });
    }

    private exportMesh(mesh: Mesh, frame: number, meshType: 'defect' | 'interface' = 'defect'): void {
        const exporter = new MeshExporter();
        const outputPath = this.getOutputPath(frame, `${meshType}_mesh`);
        exporter.toGLB(mesh, outputPath, {
            material: {
                baseColor: [1.0, 1.0, 1.0, 1.0],
                metallic: 0.0,
                roughness: 0.0,
                emissive: [0.0, 0.0, 0.0]
            },
            smoothIterations: 8,
            generateNormals: true,
            enableDoubleSided: true,
            metadata: { includeOriginalStats: true }
        });
    }

    private async handleStructuralData(data: StructureAnalysisData, frame: number): Promise<void> {
        const structureNames: string[] = Object.keys(data.structure_types);
        const stats = [];

        for(const name of structureNames){
            const { count, percentage, type_id } = data.structure_types[name];
            stats.push({
                count,
                percentage,
                typeId: type_id,
                name
            });
        }

        const filter = {
            trajectory: this.trajectoryId,
            timestep: frame
        }

        const updateData = {
            totalAtoms: data.total_atoms,
            timestep: frame,
            analysisMethod: data.analysis_method.toUpperCase(),
            types: stats,
            identifiedStructures: data.summary.total_identified,
            unidentifiedStructures: data.summary.total_unidentified,
            identificationRate: data.summary.identification_rate,
            trajectory: this.trajectoryId
        };

        await StructureAnalysis.findOneAndUpdate(filter, updateData, {
            upsert: true,
            new: true,
            runValidators: true
        });
    }

    private async handleSimulationCellData(data: any, frame: number): Promise<void> {
        const filter = {
            trajectory: this.trajectoryId,
            timestep: frame
        };

        const updateData = {
            ...data,
            trajectory: this.trajectoryId,
            timestep: frame
        };

        await SimulationCell.findOneAndUpdate(filter, updateData, {
            upsert: true,
            new: true,
            runValidators: true
        });
    }
}

export default OpenDXAService;