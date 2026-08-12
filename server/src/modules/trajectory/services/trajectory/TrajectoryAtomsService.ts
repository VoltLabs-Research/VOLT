import { ErrorCodes } from '@core/constants/error-codes';
import AnalysisEntity from '@modules/analysis/models/Analysis';
import teamClusterSelectionService from '@modules/container/services/TeamClusterSelectionService';
import Trajectory from '@modules/trajectory/models/Trajectory';
import { concatAtomsColumnarOutputs, toAtomsColumnarOutput } from '@modules/trajectory/services/trajectory/atoms-columnar';
import { readAtomsPage } from '@modules/trajectory/services/trajectory/TrajectoryReader';
import { normalizeAnalysisId } from '@modules/trajectory/services/trajectory/TrajectoryAnalysis';
import ApplicationError from '@shared/application/errors/ApplicationError';

import type {
    GetAtomsColumnarInput,
    GetAtomsColumnarOutput
} from '@modules/trajectory/services/TrajectoryServiceTypes';

const MAX_ATOMS_PER_PAGE = 5_000_000;

/*
 * Atoms per daemon round trip. Small enough that a chunk's JSON stays far from V8's
 * string ceiling and answers well inside the 30 s command timeout, large enough that a
 * multi-million-atom frame needs tens of hops rather than thousands.
 */
const ATOMS_CHUNK_SIZE = 250_000;

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

    /*
     * Atoms cross the daemon channel as row-shaped JSON, so one hop for a whole
     * multi-million-atom frame overran both the 30 s command timeout and V8's string
     * ceiling — the caller saw a 500 with no detail. A request wider than one chunk is
     * read as several and stitched, which keeps every hop small without changing what the
     * client receives. A request that already fits keeps the single round trip it had.
     */
    const chunkCount = Math.ceil(limit / ATOMS_CHUNK_SIZE);
    const chunkSize = chunkCount > 1 ? ATOMS_CHUNK_SIZE : limit;
    const firstChunk = ((page - 1) * limit) / chunkSize + 1;
    const chunks: GetAtomsColumnarOutput[] = [];

    for (let index = 0; index < chunkCount; index += 1) {
        const atomsPage = await readAtomsPage(
            computeClusterId,
            trajectoryId,
            timestep,
            firstChunk + index,
            chunkSize,
            analysisId,
            trajectory.storageClusterId
        );
        const converted = toAtomsColumnarOutput(atomsPage, page, limit);
        chunks.push(converted);

        /* The frame ended inside this chunk, so there is nothing after it to ask for. */
        if (converted.count < chunkSize) {
            break;
        }
    }

    return concatAtomsColumnarOutputs(chunks, page, limit);
};
