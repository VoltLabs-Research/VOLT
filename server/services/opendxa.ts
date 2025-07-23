import{ spawn }from 'child_process';
import{ promises as fs, createReadStream }from 'fs';
import { streamObject } from 'stream-json/streamers/StreamObject';
import { parser } from 'stream-json';
import path from 'path';
import os from 'os';
import MeshExporter,{ Mesh }from '@utilities/export/mesh';
import DislocationExporter,{ Dislocation }from '@utilities/export/dislocations';
import LAMMPSToGLTFExporter,{ AtomsData }from '@utilities/export/atoms';
import StructureAnalysis from '@models/structureAnalysis';
import SimulationCell from '@models/simulationCell';

export enum LatticeStructure{
    FCC = 'FCC',
    HCP = 'HCP',
    BCC = 'BCC',
    CubicDiamond = 'CUBIC_DIAMOND',
    HexDiamond = 'HEX_DIAMOND',
}

export enum IdentificationMode{
    CNA = 'CNA',
    PTM = 'PTM',
}

export interface ConfigParameters{
    crystalStructure?: LatticeStructure;
    maxTrialCircuitSize?: number;
    circuitStretchability?: number;
    onlyPerfectDislocations?: boolean;
    identificationMode?: IdentificationMode;
    lineSmoothingLevel?: number;
    linePointInterval?: number;
    markCoreAtoms?: boolean;
}

interface StructureTypeStat{
    [key: string]:{
        count: number;
        percentage: number;
        type_id: number;
    }
}

interface StructureAnalysisData{
    total_atoms: number;
    analysis_method: 'PTM' | 'CNA';
    structure_types: StructureTypeStat;
    summary:{
        total_identified: number;
        total_unidentified: number;
        identification_rate: number;
        unique_structure_types: number;
    }
}

const CLI_EXECUTABLE_PATH = path.resolve(__dirname, '../../opendxa/build/opendxa');

const JSON_OUTPUT_MAP ={
    defect_mesh: '_defect_mesh.json',
    atoms: '_atoms.json',
    dislocations: '_dislocations.json',
    interface_mesh: '_interface_mesh.json',
    structures: '_structures_stats.json',
    simulation_cell: '_simulation_cell.json',
};

function parseTimestepFromFilename(filename: string): number{
    const match = filename.match(/\d+/g);
    if(match){
        const timestepStr = match[match.length - 1];
        return parseInt(timestepStr, 10);
    }
    throw new Error(`Could not extract timestep from filename: ${filename}`);
}

function buildCliArgs(options: ConfigParameters): string[]{
    const args: string[] = [];
    const optionMap:{ [key in keyof ConfigParameters]: string }={
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
            const cliFlag = optionMap[key];
            const value = options[key as keyof ConfigParameters];
            if(cliFlag && value !== undefined && value !== null){
                args.push(cliFlag, String(value));
            }
        }
    }

    return args;
}

async function readLargeJsonFile(filePath: string): Promise<any>{
    const stats = await fs.stat(filePath);
    
    console.log(`[OpenDXAService] Reading file ${path.basename(filePath)}(${(stats.size / 1024 / 1024).toFixed(2)}MB)`);
    return await readJsonStream(filePath);
}

export async function readJsonStream(filePath: string): Promise<any> {
    return new Promise((resolve, reject) => {
        const pipeline = createReadStream(filePath, { encoding: 'utf8' })
            .pipe(parser())
            .pipe(streamObject());

        const result: Record<string, any> = {};

        pipeline.on('data', ({ key, value }) => {
            result[key] = value;
        });

        pipeline.on('end', () => {
            resolve(result);
        });

        pipeline.on('error', (error) => {
            if(error.message.includes('Invalid string length')){
                reject(new Error(`Failed to parse JSON due to extreme size, even with streaming. Original error: ${error.message}`));
            }else{
                reject(new Error(`Failed to read or parse JSON stream: ${error.message}`));
            }
        });
    });
}

class OpenDXAService{
    private trajectoryId: string;
    private exportDirectory: string;

    constructor(trajectoryId: string, trajectoryFolderPath: string){
        this.exportDirectory = path.join(trajectoryFolderPath, 'gltf');
        this.trajectoryId = trajectoryId;
    }

    public async analyzeTrajectory(inputFiles: string[], options: ConfigParameters ={}): Promise<any[]>{
        console.log(`[OpenDXAService] Starting analysis for ${inputFiles.length}frames.`);
        
        const cliOptions = buildCliArgs(options);
        
        console.log('[OpenDXAService] Processing files in parallel...');
        return await this.processFilesParallel(inputFiles, cliOptions);
    }

    private async processFilesParallel(inputFiles: string[], cliOptions: string[]): Promise<any[]>{
        const processingPromises = inputFiles.map(inputFile => 
            this.processSingleFile(inputFile, cliOptions)
        );

        try{
            const allResults = await Promise.all(processingPromises);
            console.log('[OpenDXAService] Parallel processing completed successfully.');
            return allResults.filter(result => result !== null);
        }catch(error){
            console.error('[OpenDXAService] Error during parallel processing:', error);
            throw error;
        }
    }

    private async processSingleFile(inputFile: string, cliOptions: string[]): Promise<any>{
        const baseFilename = path.basename(inputFile);
        console.log(`[OpenDXAService] Starting processing for: ${baseFilename}`);
        
        const outputBase = path.join(os.tmpdir(), `opendxa-out-${this.trajectoryId}-${Date.now()}-${baseFilename}`);

        try{
            await this.runCliProcess(inputFile, outputBase, cliOptions);
            const{ frameResult, generatedFiles }= await this.readOutputFiles(outputBase);

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
            return frameResult;
        }catch(error){
            console.error(`[OpenDXAService] Failed to process ${inputFile}:`, error);
            
            // Enhanced error logging
            if(error.message.includes('Invalid string length')){
                console.error('[OpenDXAService] This appears to be a large file issue. Consider:');
                console.error('1. Reducing the number of atoms in the simulation');
                console.error('2. Using a different output format');
                console.error('3. Processing files sequentially instead of in parallel');
            }
            
            throw error;
        }
    }

    private runCliProcess(inputFile: string, outputBase: string, optionsArgs: string[]): Promise<void>{
        return new Promise((resolve, reject) =>{
            const args = [inputFile, outputBase, ...optionsArgs];
            console.log(`[OpenDXAService] Running CLI with arguments: ${args.join(' ')}`);

            const cliProcess = spawn(CLI_EXECUTABLE_PATH, args);

            let stderrOutput = '';
            cliProcess.stdout.on('data',(data) =>{
                console.log(`[OpenDXA CLI]: ${data.toString().trim()}`);
            });

            cliProcess.stderr.on('data',(data) =>{
                const message = data.toString().trim();
                console.error(`[OpenDXA CLI ERROR]: ${message}`);
                stderrOutput += message + '\n';
            });

            cliProcess.on('close',(code) =>{
                if(code === 0){
                    resolve();
                }else{
                    const errorMessage = `OpenDXA CLI process exited with code ${code}.\nError log:\n${stderrOutput}`;
                    reject(new Error(errorMessage));
                }
            });

            cliProcess.on('error',(err) =>{
                reject(new Error(`Failed to start OpenDXA CLI process: ${err.message}`));
            });
        });
    }

    private async readOutputFiles(outputBase: string): Promise<{ frameResult: any, generatedFiles: string[] }>{
        const frameResult: any ={};
        const generatedFiles: string[] = [];

        for(const [key, suffix] of Object.entries(JSON_OUTPUT_MAP)){
            const jsonPath = outputBase + suffix;
            
            try{
                frameResult[key] = await readLargeJsonFile(jsonPath);
                generatedFiles.push(jsonPath);
                
                console.log(`[OpenDXAService] Successfully read ${key}from ${path.basename(jsonPath)}`);
            }catch(readError: any){
                console.error(`Failed to read or parse ${jsonPath}:`, readError.message);
                try{
                    const stats = await fs.stat(jsonPath);
                    console.error(`File size: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
                }catch(statError){
                    console.error(`Could not get file stats: ${statError.message}`);
                }
                
                throw new Error(`Could not process output file ${jsonPath}: ${readError.message}`);
            }
        }
        return{ frameResult, generatedFiles };
    }

    private async processFrameData(frameResult: any, timestep: number): Promise<void>{
        const{ interface_mesh, defect_mesh, dislocations, atoms, structures, simulation_cell }= frameResult;

        await Promise.all([
            this.exportMesh(defect_mesh, timestep, 'defect'),
            this.exportMesh(interface_mesh, timestep, 'interface'),
            this.exportDislocations(dislocations, timestep),
            this.exportAtomsColoredByType(atoms, timestep),
            this.handleStructuralData(structures, timestep),
            this.handleSimulationCellData(simulation_cell, timestep)
        ]);
    }

    private getOutputPath(frame: number, exportName: string): string{
        return path.join(this.exportDirectory, `frame_${frame}_${exportName}.gltf`)
    }

    private exportAtomsColoredByType(atoms: AtomsData, frame: number): void{
        const exporter = new LAMMPSToGLTFExporter();
        const outputPath = this.getOutputPath(frame, 'atoms_colored_by_type');
        exporter.exportAtomsTypeToGLTF(atoms, outputPath);
    }

    private exportDislocations(dislocation: Dislocation, frame: number): void{
        const exporter = new DislocationExporter();
        const outputPath = this.getOutputPath(frame, 'dislocations');
        exporter.toGLTF(dislocation, outputPath,{
            lineWidth: 0.3,
            colorByType: true,
            material:{
                baseColor: [1.0, 0.5, 0.0, 1.0],
                metallic: 0.0,
                roughness: 0.8
            }
        });
    }

    private exportMesh(mesh: Mesh, frame: number, meshType: 'defect' | 'interface' = 'defect'): void{
        const exporter = new MeshExporter();
        const outputPath = this.getOutputPath(frame, `${meshType}_mesh`);
        exporter.toGLTF(mesh, outputPath,{
            material:{
                baseColor: [1.0, 1.0, 1.0, 1.0],
                metallic: 0.0,
                roughness: 0.0,
                emissive: [0.0, 0.0, 0.0]
            },
            smoothIterations: 8,
            generateNormals: true,
            enableDoubleSided: true,
            metadata:{ includeOriginalStats: true }
        });
    }

    private async handleStructuralData(data: StructureAnalysisData, frame: number): Promise<void>{
        const structureNames: string[] = Object.keys(data.structure_types);
        const stats = [];

        for(const name of structureNames){
            const{ count, percentage, type_id }= data.structure_types[name];
            stats.push({
                count,
                percentage,
                typeId: type_id,
                name
            });
        }

        const filter ={
            trajectory: this.trajectoryId,
            timestep: frame
        }

        const updateData ={
            totalAtoms: data.total_atoms,
            timestep: frame,
            analysisMethod: data.analysis_method.toUpperCase(),
            types: stats,
            identifiedStructures: data.summary.total_identified,
            unidentifiedStructures: data.summary.total_unidentified,
            identificationRate: data.summary.identification_rate,
            trajectory: this.trajectoryId
        };
        
        await StructureAnalysis.findOneAndUpdate(filter, updateData,{
            upsert: true,
            new: true,
            runValidators: true
        });
    }

    private async handleSimulationCellData(data: any, frame: number): Promise<void>{
        const filter ={
            trajectory: this.trajectoryId,
            timestep: frame
        };

        const updateData ={
            ...data,
            trajectory: this.trajectoryId,
            timestep: frame
        };

        await SimulationCell.findOneAndUpdate(filter, updateData,{
            upsert: true,
            new: true,
            runValidators: true
        });
    }
}

export default OpenDXAService;