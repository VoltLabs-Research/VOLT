import AnalysisConfig from '@/models/analysis-config';
import Dislocation from '@/models/dislocations';
import StructureAnalysis from '@/models/structure-analysis';
import Trajectory from '@/models/trajectory';
import SimulationCell from '@/models/simulation-cell';
import fs from 'fs/promises';
import path from 'path';

export enum AnalysisStatsError{
    TrajectoryDocumentNotFound,
    AnalysisDocumentNotFound
}

export const computeDislocationsDensity = async (dislocations: any[]): Promise<any> => {
    const stats = [];

    // Dislocation Density = 1/V * Total Segments Length
    for(const dislocation of dislocations){
        const { timestep, trajectory, totalLength } = dislocation;
        
        const simulationCell = await SimulationCell.findOne({ timestep, trajectory });
        if(!simulationCell) continue;

        const { volume } = simulationCell;
        const density = (1 / volume) * totalLength;

        stats.push({
            timestep,
            density
        });
    }

    return stats;
};

// TODO: clean analysisConfig from front-end
export const computeAnalysisStats = async (trajectoryId: string): Promise<any> => {
    console.log('Getting Trajectory:', trajectoryId);

    const trajectory = await Trajectory.findById(trajectoryId);
    if(!trajectory){
        return AnalysisStatsError.TrajectoryDocumentNotFound;
    }

    const trajectoryAnalysis = await AnalysisConfig.find({ trajectory: trajectory._id });
    if(!trajectoryAnalysis.length){
        return AnalysisStatsError.AnalysisDocumentNotFound;
    }

    console.log('Trajectory Analysis (GET) [OK]', trajectoryAnalysis.length);

    const stats = [];

    for(const analysis of trajectoryAnalysis){
        console.log('Working with:', analysis._id)
        const filter = { analysisConfig: analysis._id };
        const dislocations = await Dislocation
            .find(filter)
            .select({
                totalSegments: 1,
                timestep: 1,
                dislocations: {
                    segmentId: 1,
                    length: 1,
                    burgers: 1
                },
                averageSegmentLength: 1,
                totalLength: 1
            });
        
        console.log('Dislocations (GET) [OK]', dislocations.length);

        const structureAnalysis = await StructureAnalysis
            .find(filter)
            .select({
                totalAtoms: 1,
                timestep: 1,
                analysisMethod: 1,
                types: 1,
                identifiedStructures: 1,
                unidentifiedStructures: 1,
                identificationRate: 1
            });

        console.log('Structure Analysis (GET) [OK]', structureAnalysis.length);

        const identificationMode = analysis.identificationMode.toUpperCase();

        const dislocationsDensity = await computeDislocationsDensity(dislocations);
        console.log('Dislocations Density [OK]', dislocationsDensity.length);

        stats.push({
            dislocations,
            dislocationsDensity,
            structureAnalysis,
            rmsd: identificationMode === 'PTM' ? analysis.RMSD : 0
        });
    }

    const folderPath = path.join(process.env.TRAJECTORY_DIR as string, trajectory.folderId);
    const analysisPath = path.join(folderPath, 'analysis-stats.json');

    await fs.writeFile(analysisPath, JSON.stringify(stats));
};