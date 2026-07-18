import { get, post, del } from '../../shared/routing';
import type {
    PersistedAnalysis,
    RetryFailedFramesResponse,
    AnalysisFrameLogResponse,
    ProvenanceRecord,
    ProvenanceQueryResponse,
    ProvenanceReproduceResponse
} from './domain';

export const analysisRoutes = {
    listByTeamId: get<PersistedAnalysis>('/api/analyses/:teamId'),
    listByTrajectoryId: get<PersistedAnalysis>('/api/analyses/:teamId/trajectory/:trajectoryId'),
    getFrameLog: get<AnalysisFrameLogResponse>('/api/analyses/:teamId/:analysisId/logs/:timestep'),
    retryFailedFrames: post<never, RetryFailedFramesResponse>('/api/analyses/:teamId/:analysisId/failed-frames/retries'),
    getById: get<PersistedAnalysis>('/api/analyses/:teamId/:analysisId'),
    remove: del('/api/analyses/:teamId/:analysisId')
} as const;

export const provenanceRoutes = {
    query: get<ProvenanceQueryResponse>('/api/provenance/:teamId/query'),
    get: get<ProvenanceRecord>('/api/provenance/:teamId/:provenanceId'),
    reproduce: post<never, ProvenanceReproduceResponse>('/api/provenance/:teamId/:provenanceId/reproduce')
} as const;
