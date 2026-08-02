import { ErrorCodes } from '@core/constants/error-codes';
import AnalysisEntity from '@modules/analysis/models/Analysis';
import teamClusterSelectionService from '@modules/container/services/TeamClusterSelectionService';
import Trajectory from '@modules/trajectory/models/Trajectory';
import { toAtomsColumnarOutput } from '@modules/trajectory/services/trajectory/atoms-columnar';
import { readAtomsPage } from '@modules/trajectory/services/trajectory/TrajectoryReader';
import { normalizeAnalysisId } from '@modules/trajectory/services/trajectory/TrajectoryAnalysis';
import ApplicationError from '@shared/application/errors/ApplicationError';

import type {
    GetAtomsColumnarInput,
    GetAtomsColumnarOutput
} from '@modules/trajectory/services/TrajectoryServiceTypes';

const MAX_ATOMS_PER_PAGE = 5_000_000;

/**
 * Atoms are read on the compute cluster that produced them: an analysis pins its
 * own cluster, a bare dump falls back to whichever cluster serves the storage.
 */
const resolveComputeClusterId = async (
    trajectory: Trajectory,
    trajectoryId: string,
    analysisId?: string
): Promise<string> => {
    if (analysisId) {
        const analysis = await AnalysisEntity.findOneBy({ id: analysisId });
        if (!analysis) {
            throw ApplicationError.notFound(ErrorCodes.ANALYSIS_NOT_FOUND, 'Analysis not found');
        }
        if (analysis.trajectory !== trajectoryId) {
            throw ApplicationError.badRequest(
                ErrorCodes.TRAJECTORY_ANALYSIS_MISMATCH,
                'Analysis does not belong to the requested trajectory'
            );
        }
        if (analysis.computeClusterId) {
            return analysis.computeClusterId;
        }
    }

    return teamClusterSelectionService.resolveComputeClusterId(
        trajectory.team,
        undefined,
        trajectory.storageClusterId
    );
};

export const getTrajectoryAtoms = async (input: GetAtomsColumnarInput): Promise<GetAtomsColumnarOutput> => {
    const { trajectoryId, timestep } = input;
    const analysisId = normalizeAnalysisId(input.analysisId);
    const page = Math.max(1, input.page ?? 1);
    const limit = Math.min(MAX_ATOMS_PER_PAGE, Math.max(1, input.limit ?? MAX_ATOMS_PER_PAGE));

    const trajectory = await Trajectory.findOneBy({ id: trajectoryId });
    if (!trajectory) {
        throw ApplicationError.notFound(ErrorCodes.TRAJECTORY_NOT_FOUND, 'Trajectory not found');
    }

    const computeClusterId = await resolveComputeClusterId(trajectory, trajectoryId, analysisId);
    const atomsPage = await readAtomsPage(
        computeClusterId,
        trajectoryId,
        timestep,
        page,
        limit,
        analysisId,
        trajectory.storageClusterId
    );

    return toAtomsColumnarOutput(atomsPage, page, limit);
};
