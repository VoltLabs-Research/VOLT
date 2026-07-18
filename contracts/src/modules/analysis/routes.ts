import { get, post, del } from '../../shared/routing';
import type {
    PersistedAnalysis,
    RetryFailedFramesResponse,
    AnalysisFrameLogResponse,
    ProvenanceRecord,
    ProvenanceQueryResponse,
    ProvenanceReproduceResponse
} from './domain';

/**
 * Every client-facing analysis endpoint, typed by request/response. Full wire
 * paths (team-scoped under `/api/analyses/:teamId`), matching the previous
 * `createHttpModule({ basePath: '/api/analyses/:teamId' })` verbatim. Literal
 * `/trajectory` and the `/logs`, `/failed-frames` sub-paths are declared before
 * the bare `/:analysisId` param routes so Express matches them first.
 */
export const analysisRoutes = {
    listByTeamId: get<PersistedAnalysis>('/api/analyses/:teamId'),
    listByTrajectoryId: get<PersistedAnalysis>('/api/analyses/:teamId/trajectory/:trajectoryId'),
    getFrameLog: get<AnalysisFrameLogResponse>('/api/analyses/:teamId/:analysisId/logs/:timestep'),
    retryFailedFrames: post<never, RetryFailedFramesResponse>('/api/analyses/:teamId/:analysisId/failed-frames/retries'),
    getById: get<PersistedAnalysis>('/api/analyses/:teamId/:analysisId'),
    remove: del('/api/analyses/:teamId/:analysisId')
} as const;

/**
 * Provenance endpoints (team-scoped under `/api/provenance/:teamId`), matching
 * the previous `createHttpModule({ basePath: '/api/provenance/:teamId' })`. The
 * handlers respond with raw JSON (no BaseResponse envelope) — reproduced by the
 * controller via `@Res()`. `/query` is declared before the `/:provenanceId`
 * param route.
 */
export const provenanceRoutes = {
    query: get<ProvenanceQueryResponse>('/api/provenance/:teamId/query'),
    get: get<ProvenanceRecord>('/api/provenance/:teamId/:provenanceId'),
    reproduce: post<never, ProvenanceReproduceResponse>('/api/provenance/:teamId/:provenanceId/reproduce')
} as const;
