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
import { StructureAnalysis, SimulationCell, Dislocations } from '@/models/index';
import { upsert } from '@/utilities/mongo/mongo-utils';
import path from 'path';
import os from 'os';
import MeshExporter from '@utilities/export/mesh';
import DislocationExporter from '@utilities/export/dislocations';
import AtomisticExporter from '@utilities/export/atoms';

/**
 * Absolute path to the compiled OpenDXA CLI executable.
 * TODO: add debug path.
 * @internal
 */
const CLI_EXECUTABLE_PATH = path.resolve(__dirname, '../../opendxa/build/opendxa');

/**
 * Mapping of logical output groups to their msgpack file suffixes
 * emitted by the OpenDXA CLI.
 * @internal
 */
const MSGPACK_OUTPUT_MAP = {
    defect_mesh: '_defect_mesh.msgpack',
    atoms: '_atoms.msgpack',
    dislocations: '_dislocations.msgpack',
    interface_mesh: '_interface_mesh.msgpack',
    structures: '_structures_stats.msgpack',
    simulation_cell: '_simulation_cell.msgpack',
};

// helper: ¿existe el archivo?
async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

// helper: lee msgpack si existe; si no, devuelve null
async function readMsgpackOptional(p: string): Promise<any | null> {
  if (!(await fileExists(p))) return null;
  try {
    return await readMsgpackFile(p);
  } catch (err: any) {
    // si existe pero está corrupto, loguea y devuelve null en vez de reventar todo
    console.error(`[OpenDXAService] No se pudo decodificar ${path.basename(p)}: ${err.message}`);
    return null;
  }
}


/**
 * Extract the timestep number from a filename.
 * 
 * It searches for all digit groups and returns the last one as an integer,
 * e.g. `"frame_000123.dump"` -> `123`.
 * 
 * @param filename - Source filename that includes a timestep number.
 * @returns Parsed timestep as a number.
 * @throws If a numeric group cannot be found in the filename.
 */
function parseTimestepFromFilename(filename: string): number {
    const match = filename.match(/\d+/g);
    if(match){
        const timestepStr = match[match.length - 1];
        return parseInt(timestepStr, 10);
    }
    throw new Error(`Could not extract timestep from filename: ${filename}`);
}

/**
 * Builds a list of CLI flags and argument values for the OpenDXA binary
 * from a strongly-typed {@link ConfigParameters} object.
 * 
 * Only defined (non-null/undefined) parameters are included.
 * 
 * @param options - Configuration parameters for structure analysis.
 * @returns Array of CLI arguments, e.g. `["--rmsd","0.1","--crystalStructure","BCC"]`.
 */
function buildCliArgs(options: ConfigParameters): string[] {
    const args: string[] = [];
    const optionMap: { [key in keyof ConfigParameters]: string } = {
        crystalStructure: '--crystalStructure',
        maxTrialCircuitSize: '--maxTrialCircuitSize',
        circuitStretchability: '--circuitStretchability',
        defectMeshSmoothingLevel: '--defectSmoothingLevel',
        onlyPerfectDislocations: '--onlyPerfectDislocations',
        RMSD: '--rmsd',
        identificationMode: '--identificationMode',
        lineSmoothingLevel: '--lineSmoothingLevel',
        linePointInterval: '--linePointInterval',
        markCoreAtoms: '--markCoreAtoms',
        structureIdentificationOnly: '--structureIdentificationOnly'
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

/**
 * Service that orchestrates execution of the OpenDXA CLI for a trajectory frame,
 * parses its msgpack outputs, saves structured results to the database,
 * and exports GLB visualizations (meshes, dislocations, atomistic models).
 * 
 * Typical flow:
 * 1. {@link OpenDXAService.processSingleFile}: runs CLI for a specific input file.
 * 2. Reads msgpack artifacts via {@link readMsgpackFile}.
 * 3. Persists analysis results via Mongo upserts.
 * 4. Exports GLB files for frontend visualization.
 */
class OpenDXAService{
    private trajectoryId: string;
    private exportDirectory: string;
    private trajectoryFolderPath: string;
    private analysisConfigId: string;

    /**
     * Creates a new service instance bound to a trajectory and analysis config.
     * 
     * @param trajectoryId - Trajectory document id.
     * @param trajectoryFolderPath - Base folder containing trajectory artifacts.
     * @param analysisConfigId - Identifier of the analysis configuration used.
     */
    constructor(trajectoryId: string, trajectoryFolderPath: string, analysisConfigId: string){
        this.exportDirectory = path.join(trajectoryFolderPath, 'glb');
        this.trajectoryId = trajectoryId;
        this.trajectoryFolderPath = trajectoryFolderPath;
        this.analysisConfigId = analysisConfigId;
    }

    /**
     * Runs the OpenDXA CLI on a single input file (frame), ingests the produced 
     * msgpack outputs, persists them, exports GLB fies, and cleans temp files.
     * 
     * @param inputFile - Absolute path to the input frame file.
     * @param options - CLI config parameters for this analysis.
     * @returns A promise that resolves when processing is complete.
     * @throws Propagates any CLI, I/O, or decoding errors.
     */
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
            await this.processFrameData(frameResult, timestep, options);

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

    /**
     * Spawns the OpenDXA CLI process for an input frame.
     * 
     * @param inputFile - Path to the input file to analyze.
     * @param outputBase - Base path prefix for msgpack outputs.
     * @param optionsArgs - CLI flag/value pairs built by {@link buildCliArgs}.
     * @returns Resolves when the CLI exists successfully (exit code 0).
     * @throws If the process exits with a non-zero code or fails to start.
     * @internal
     */
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

    /**
     * Reads and decodes all expected msgpack outputs produced by the CLI.
     * 
     * @param outputBase - Base path used by the CLI for output file names.
     * @returns An object with the decoded frame result and a list of file paths read.
     * @throws If any required output file is missing or cannot be decoded.
     * @internal
     */
   private async readOutputFiles(outputBase: string): Promise<{ frameResult: Record<string, any>, generatedFiles: string[] }> {
  const frameResult: Record<string, any> = {};
  const generatedFiles: string[] = [];

  // Si quieres marcar algunos como realmente requeridos, ponlos aquí:
  const REQUIRED_KEYS = new Set<string>([
  ]);

  for (const [key, suffix] of Object.entries(MSGPACK_OUTPUT_MAP)) {
    const filePath = outputBase + suffix;

    const data = await readMsgpackOptional(filePath);
    if (data === null) {
      const msg = (await fileExists(filePath))
        ? 'Archivo existe pero no se pudo leer/decodificar'
        : 'Archivo no encontrado (CLI no lo generó)';
      console.warn(`[OpenDXAService] ${msg}: ${path.basename(filePath)} (clave: ${key})`);

      if (REQUIRED_KEYS.has(key)) {
        // si de verdad es indispensable, ahí sí aborta con un mensaje claro
        throw new Error(`Falta salida requerida "${key}" (${filePath}).`);
      }
      // si no es requerido, continúa sin agregarlo
      continue;
    }

    frameResult[key] = data;
    generatedFiles.push(filePath);
    console.log(`[OpenDXAService] Leído ${key} desde ${path.basename(filePath)}`);
  }

  return { frameResult, generatedFiles };
}

  
    /**
     * Persists decoded data and triggers GLB exports for a single frame.
     * 
     * If `structureIdentificationOnly` is enabled in {@link ConfigParameters},
     * only atom-coloring export is performed and persistence of other entities is skipped.
     * 
     * @param frameResult - Decoded msgpack payloads keyed by output name.
     * @param timestep - Frame timestep extracted from filename.
     * @param options - Analysis configuration used for this run.
     * @internal
     */
private async processFrameData(frameResult: any, timestep: number, options: ConfigParameters): Promise<void> {
  const { interface_mesh, defect_mesh, dislocations, atoms, structures, simulation_cell } = frameResult;

  // Si solo hay identificación de estructura, normalmente basta con los átomos
  if (options?.structureIdentificationOnly) {
    if (atoms) {
      this.exportAtomsColoredByType(atoms, timestep);
    } else {
      console.warn(`[OpenDXAService] No hay "atoms" para exportar en timestep ${timestep}.`);
    }
    return;
  }

  const tasks: Promise<any>[] = [];

  if (defect_mesh) tasks.push(Promise.resolve(this.exportMesh(defect_mesh, timestep, 'defect')));
  else console.warn(`[OpenDXAService] No hay defect_mesh en ${timestep}.`);

  if (interface_mesh) tasks.push(Promise.resolve(this.exportMesh(interface_mesh, timestep, 'interface')));
  else console.warn(`[OpenDXAService] No hay interface_mesh en ${timestep}.`);

  if (dislocations) {
    tasks.push(Promise.resolve(this.exportDislocations(dislocations, timestep)));
    tasks.push(this.handleDislocationData(dislocations, timestep));
  } else {
    console.warn(`[OpenDXAService] No hay dislocations en ${timestep}.`);
  }

  if (atoms) tasks.push(Promise.resolve(this.exportAtomsColoredByType(atoms, timestep)));
  else console.warn(`[OpenDXAService] No hay atoms en ${timestep}.`);

  if (simulation_cell) tasks.push(this.handleSimulationCellData(simulation_cell, timestep));
  else console.warn(`[OpenDXAService] No hay simulation_cell en ${timestep}.`);

  if (structures) tasks.push(this.handleStructuralData(structures, timestep));
  else console.warn(`[OpenDXAService] No hay structures en ${timestep}.`);

  // Ejecuta lo que haya, y si algo individual falla, no tumba todo
  const results = await Promise.allSettled(tasks);
  for (const r of results) {
    if (r.status === 'rejected') {
      console.error('[OpenDXAService] Tarea individual falló:', r.reason);
    }
  }
}

    /**
     * Upserts dislocations analytics into the database for a frame.
     * 
     * @param data - Dislocation dataset decoded from msgpack.
     * @param internal - Frame timestep.
     * @internal
     */
    private async handleDislocationData(data: Dislocation, timestep: number): Promise<void>{
        const filter = {
            trajectory: this.trajectoryId,
            timestep,
            analysisConfig: this.analysisConfigId
        };

        const updateData = {
            totalSegments: data.metadata.count,
            dislocations: data.data.map((dislocation) => ({
                segmentId: dislocation.segment_id,
                type: dislocation.type,
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
            analysisConfig: this.analysisConfigId,
            trajectory: this.trajectoryId,
            timestep
        };

        try{
            await upsert(Dislocations, filter, { $set: updateData });
        }catch(err){
            console.error(`[OpenDXAService] Failed to save dislocation data for timestep ${timestep}:`, err);
        }
    }

    /**
     * Computes the canonical GLB output path for a given frame and export group.
     * 
     * @param frame - Timestep/frame number.
	 * @param exportName - Short export label (e.g., `'defect'`, `'atoms_colored_by_type'`).
	 * @returns Absolute GLB path.
	 * @internal
    */
    private getOutputPath(frame: number, exportName: string): string {
        // TODO: mongoose document type
        // @ts-ignore
        return path.join(this.exportDirectory, `frame-${frame}_${exportName}_analysis-${this.analysisConfigId}.glb`)
    }

    /**
	 * Exports atom groups to a GLB with per-type coloring.
	 *
	 * @param groupedAtoms - Atoms grouped by type.
	 * @param frame - Timestep/frame number.
	 * @internal
	 */
    private exportAtomsColoredByType(groupedAtoms: AtomsGroupedByType, frame: number): void {
        const exporter = new AtomisticExporter();
        const outputPath = this.getOutputPath(frame, 'atoms_colored_by_type');
        exporter.exportAtomsTypeToGLB(groupedAtoms, outputPath);
    }

    /**
	 * Exports dislocation lines as a GLB, color-coded by type and with basic PBR material.
     * 
     * @param dislocation - Dislocation dataset.
     * @param frame - Timestep/frame number.
     * @internal
     */
    private exportDislocations(dislocation: Dislocation, frame: number): void {
        const exporter = new DislocationExporter();
        const outputPath = this.getOutputPath(frame, 'dislocations');
        exporter.toGLB(dislocation, outputPath, {
            lineWidth: 0.8,
            colorByType: true,
            material: {
                baseColor: [1.0, 0.5, 0.0, 1.0],
                metallic: 0.0,
                roughness: 0.8,
                emissive: [0.0, 0.0, 0.0]
            }
        });
    }

    /**
     * Exports a defect/interface mesh as GLB.
     * 
     * @param mesh - Mesh payload.
     * @param frame - Timestep/frame number.
     * @param meshType - Label, defaults to `'defect'`.
     */
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

    /**
     * Upserts structure-identification statistics for a frame.
     * 
     * @param data - Structure analysis dataset (counts, rates, per-type stats).
     * @param frame - Timestep/frame number.
     */
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
            timestep: frame,
            analysisMethod: data.analysis_method.toUpperCase(),
            analysisConfig: this.analysisConfigId
        }

        const updateData = {
            totalAtoms: data.total_atoms,
            timestep: frame,
            analysisMethod: data.analysis_method.toUpperCase(),
            types: stats,
            identifiedStructures: data.summary.total_identified,
            unidentifiedStructures: data.summary.total_unidentified,
            identificationRate: data.summary.identification_rate,
            trajectory: this.trajectoryId,
            analysisConfig: this.analysisConfigId
        };

        await upsert(StructureAnalysis, filter, { $set: updateData });
    }

    /**
     * Upserts simulation cell information for a frame.
     * @param data - Simulation cell payload decoded from msgpack.
     * @param frame - Timestep/frame number.
     * @internal
     */
    private async handleSimulationCellData(data: any, frame: number): Promise<void> {
        const filter = {
            trajectory: this.trajectoryId,
            timestep: frame,
            analysisConfig: this.analysisConfigId
        };

        // TODO: I'm saving all information? What about other handler* methods?
        const updateData = {
            periodicBoundaryConditions: data.periodic_boundary_conditions,
            angles: data.angles,
            matrix: data.matrix,
            reciprocalLattice: data.reciprocal_lattice,
            dimensionality: data.dimensionality,
            trajectory: this.trajectoryId,
            volume: data.volume,
            timestep: frame,
            analysisConfig: this.analysisConfigId
        };
        
        await upsert(SimulationCell, filter, { $set: updateData });
    }
}

export default OpenDXAService;