import { get, post, del } from '../../shared/routing';
import type {
    Analysis,
    RetryFailedFramesResponse,
    AnalysisFrameLogResponse,
    ProvenanceRecord,
    ProvenanceQueryResponse,
    ProvenanceReproduceResponse
} from './domain';

export const analysisRoutes = {
    listByTeamId: get<Analysis>('/api/teams/:teamId/analyses'),
    getFrameLog: get<AnalysisFrameLogResponse>('/api/teams/:teamId/analyses/:analysisId/logs/:timestep'),
    retryFailedFrames: post<never, RetryFailedFramesResponse>('/api/teams/:teamId/analyses/:analysisId/failed-frames/retries'),
    getById: get<Analysis>('/api/teams/:teamId/analyses/:analysisId'),
    remove: del('/api/teams/:teamId/analyses/:analysisId')
} as const;

export const provenanceRoutes = {
    query: get<ProvenanceQueryResponse>('/api/teams/:teamId/provenance-records'),
    get: get<ProvenanceRecord>('/api/teams/:teamId/provenance-records/:provenanceId'),
    reproduce: get<ProvenanceReproduceResponse>('/api/teams/:teamId/provenance-records/:provenanceId/reproduction')
} as const;
