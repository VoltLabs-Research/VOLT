import AnalysisConfig from '@/models/analysis-config';
import StructureAnalysis from '@/models/structure-analysis';
import Trajectory from '@/models/trajectory';

export enum AnalysisStatsError{
    TrajectoryDocumentNotFound,
    AnalysisDocumentNotFound
}

interface DislocationStat{
    totalDislocations: number;
    averageSegmentLength: number;
    maxSegmentLength: number;
    minSegmentLength: number;
    totalLength: number;
}

interface AnalysisStat{
    id: string;
    dislocations: DislocationStat;
}

export interface AnalysisStats{
    ptm: [AnalysisStat],
    cna: [AnalysisStat]
}

export const computeAnalysisStats = async (trajectoryId: string): Promise<any> => {
    const trajectory = await Trajectory.findById(trajectoryId);
    if(!trajectory){
        return AnalysisStatsError.TrajectoryDocumentNotFound;
    }

    const trajectoryAnalysis = await AnalysisConfig
        .find({ trajectory: trajectory._id })
        .populate({
            path: 'structureAnalysis dislocations',
        });
    
    const stats: AnalysisStats = [];

    for(const analysis of trajectoryAnalysis){
        
    }
};