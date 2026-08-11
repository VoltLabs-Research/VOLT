import AnalysisEntity from '@modules/analysis/models/Analysis';
import { IsNull, Not, type FindOptionsWhere } from 'typeorm';

interface ResolvedListingSource {
    teamClusterId: string;
    analysisId: string;
}

/** Listing rows only exist in the compute cluster that ran the analysis. */
export const resolveAnalysisCluster = async (analysisId: string): Promise<string | undefined> => {
    const analysis = await AnalysisEntity.findOneBy({ id: analysisId });
    return analysis?.computeClusterId ?? undefined;
};

/**
 * A listing can be addressed by analysis, or by plugin plus optional trajectory —
 * in which case any analysis of that plugin that still has a compute cluster
 * tells us where the rows live.
 */
export const resolvePluginListingSource = async (
    input: { pluginId: string; teamId: string; analysisId?: string; trajectoryId?: string }
): Promise<ResolvedListingSource | null> => {
    if (input.analysisId) {
        const teamClusterId = await resolveAnalysisCluster(input.analysisId);

        return teamClusterId
            ? {
                teamClusterId,
                analysisId: input.analysisId
            }
            : null;
    }

    const where: FindOptionsWhere<AnalysisEntity> = {
        plugin: input.pluginId,
        computeClusterId: Not(IsNull())
    };
    if (input.trajectoryId) where.trajectory = input.trajectoryId;
    if (input.teamId) where.team = input.teamId;

    const analysis = await AnalysisEntity.findOneBy(where);

    return analysis?.computeClusterId
        ? {
            teamClusterId: analysis.computeClusterId,
            analysisId: analysis.id
        }
        : null;
};
