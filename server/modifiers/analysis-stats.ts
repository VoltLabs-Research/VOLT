import { AnalysisConfig, StructureAnalysis, Trajectory, SimulationCell } from '@/models/index';
import { listDislocationsByPrefix } from '@/buckets/dislocations';
import fs from 'fs/promises';
import path from 'path';

export enum AnalysisStatsError{
    TrajectoryDocumentNotFound,
    AnalysisDocumentNotFound
}

export const computeDislocationsDensity = async (dislocations: any[], trajectory: string): Promise<any> => {
    const stats: any = [];

    // Dislocation Density = 1/V * Total Segments Length
    const promises = dislocations.map(async (dislocation) => {
      const { timestep, totalLength } = dislocation;
        
        const simulationCell = await SimulationCell.findOne({ timestep, trajectory });
        if(!simulationCell) return;

        const { volume } = simulationCell;
        const density = (1 / volume) * totalLength;

        stats.push({
            timestep,
            density
        });
    });

    await Promise.all(promises);

    return stats;
};

// TODO: clean analysisConfig from front-end
export const computeAnalysisStats = async (trajectoryId: string): Promise<any> => {
    const trajectory = await Trajectory.findById(trajectoryId);
    if(!trajectory){
        return AnalysisStatsError.TrajectoryDocumentNotFound;
    }
    console.log('here');
    const trajectoryAnalysis = await AnalysisConfig.find({ trajectory: trajectory._id });
    if(!trajectoryAnalysis.length){
        return AnalysisStatsError.AnalysisDocumentNotFound;
    }

    const stats: any = [];
    console.log('waiting');
    const promises = trajectoryAnalysis.map(async (analysis) => {
        const prefix = `${trajectory._id.toString()}/${analysis._id.toString()}/`;
        const objects = await listDislocationsByPrefix(prefix);

        const dislocations = objects.map(({ data }) => ({
            totalSegments: data.totalSegments,
            timestep: data.timestep,
            dislocations: data.dislocations,
            averageSegmentLength: data.averageSegmentLength,
            totalLength: data.totalLength
        }));

        const structureAnalysis = await StructureAnalysis
            .find({ analysisConfig: analysis._id })
            .select({
                totalAtoms: 1,
                timestep: 1,
                analysisMethod: 1,
                types: 1,
                identifiedStructures: 1,
                unidentifiedStructures: 1,
                identificationRate: 1
            });


        const identificationMode = analysis.identificationMode.toUpperCase();

        const dislocationsDensity = await computeDislocationsDensity(dislocations, String(trajectory._id));
        console.log(identificationMode, dislocations.length, analysis.RMSD)
        stats.push({
            dislocations,
            dislocationsDensity,
            structureAnalysis,
            identificationMode, 
            rmsd: identificationMode === 'PTM' ? analysis.RMSD : 0
        });
    });

    await Promise.all(promises);
    console.log('ok')

    const folderPath = path.join(process.env.TRAJECTORY_DIR as string, trajectoryId);
    const analysisPath = path.join(folderPath, 'analysis-stats.json');

    await fs.writeFile(analysisPath, JSON.stringify(stats));

    return stats;
};