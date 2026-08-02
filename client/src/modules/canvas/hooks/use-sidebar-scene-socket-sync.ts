import { analysisQuery } from '@/modules/analysis/hooks/queries';
import {
    findCachedAnalysisById,
    updateAnalysisExecutionCaches,
    updateAnalysisStatusCaches,
    upsertAnalysisFromSocketPayload
} from '@/modules/analysis/services/cache';
import { invalidateSceneArtifacts } from '@/modules/trajectory/hooks/scene-artifacts/queries';
import { normalizeCanvasAnalysisStatus } from '../utils/analysis-status';
import { resolveJobAnalysisId } from '../utils/analysis-job-status';
import queryClient from '@/shared/query/query-client';
import { SOCKET_ANALYSIS_EVENTS } from '@/modules/socket/events/analysis';
import { SOCKET_SCENE_ARTIFACT_EVENTS } from '@/modules/socket/events/trajectory';
import { SOCKET_TEAM_EVENTS } from '@/modules/socket/events/team';
import useSocketEvent from '@/modules/socket/hooks/use-socket-event';
import { useCanvasCanCollaborate } from '@/modules/canvas/api/access';
import { useCallback } from 'react';

import type { Analysis } from '@volt/contracts/modules/analysis/domain';
import type { Job } from '@volt/contracts/modules/jobs/domain';

/*
 * Payloads broadcast by our own VOLT server: `EventBroadcastSocketModule`
 * re-emits the domain event payload verbatim, so these mirror the server event
 * contracts (`server/src/shared/contracts/events/Analysis*Payload.ts`) narrowed
 * to the fields the canvas sidebar consumes. `@volt/contracts` does not model
 * socket payloads yet, so they are declared here — once, at the subscription —
 * and trusted from there on. Declared as type aliases rather than interfaces so
 * they stay assignable to the `Record<string, unknown>` cache helpers.
 */

type AnalysisCreatedSocketPayload = {
    analysisId: string;
    trajectoryId: string;
    pluginId: string;
    pluginDisplayName: string;
    config: Record<string, unknown>;
    status: string;
    artifactStatus?: Analysis['artifactStatus'];
    expectedArtifacts?: Analysis['expectedArtifacts'];
    createdAt: string;
};

type AnalysisDeletedSocketPayload = {
    analysisId: string;
    trajectoryId: string;
};

export type AnalysisStatusSocketPayload = {
    analysisId: string;
    trajectoryId: string;
    status: string;
    totalFrames?: number;
    failedFrames?: number;
    artifactStatus?: Analysis['artifactStatus'];
    expectedArtifacts?: Analysis['expectedArtifacts'];
    stages?: Analysis['stages'];
    childAnalyses?: Analysis['childAnalyses'];
};

type AnalysisStageSocketPayload = Omit<AnalysisStatusSocketPayload, 'status' | 'totalFrames' | 'failedFrames'>;

type SceneArtifactUpsertedSocketPayload = {
    trajectoryId: string;
};

interface UseSidebarSceneSocketSyncInput {
    trajectoryId?: string;
    trajectoryName: string;
    analyses: Analysis[];
    applyDeletedAnalysisLocally: (analysisId: string) => void;
    announceAnalysisStatus: (payload: AnalysisStatusSocketPayload) => void;
}

/**
 * Mirrors the analysis and scene-artifact events broadcast for the open
 * trajectory into the local query caches, so the sidebar reflects work done by
 * the daemon (or by a collaborator) without refetching everything.
 */
const useSidebarSceneSocketSync = ({
    trajectoryId,
    trajectoryName,
    analyses,
    applyDeletedAnalysisLocally,
    announceAnalysisStatus
}: UseSidebarSceneSocketSyncInput): void => {
    const canCollaborate = useCanvasCanCollaborate();
    const enabled = !!trajectoryId && canCollaborate;

    const handleAnalysisCreated = useCallback((payload: AnalysisCreatedSocketPayload) => {
        if (payload.trajectoryId !== trajectoryId) return;
        upsertAnalysisFromSocketPayload(payload, trajectoryName);
    }, [trajectoryName, trajectoryId]);

    const handleAnalysisDeleted = useCallback((payload: AnalysisDeletedSocketPayload) => {
        if (payload.trajectoryId !== trajectoryId) return;

        applyDeletedAnalysisLocally(payload.analysisId);
        void analysisQuery.cache.invalidate();
        void invalidateSceneArtifacts();
    }, [applyDeletedAnalysisLocally, trajectoryId]);

    const patchAnalysisStatus = useCallback((payload: AnalysisStatusSocketPayload) => {
        if (payload.trajectoryId !== trajectoryId) return;

        const isKnown = Boolean(findCachedAnalysisById({
            analysisId: payload.analysisId,
            trajectoryId,
            fallbackAnalyses: analyses
        }));

        // An analysis we have never seen means our listing is stale, not that a
        // single entity needs patching.
        if (!isKnown) {
            void queryClient.invalidateQueries({ queryKey: analysisQuery.QUERY_KEYS.lists() });
            void queryClient.invalidateQueries({
                predicate: (query) => {
                    return query.queryKey.includes('analysis') && query.queryKey.includes('byTrajectory');
                }
            });
            return;
        }

        const status = normalizeCanvasAnalysisStatus(payload.status);
        if (!status) return;

        updateAnalysisStatusCaches({
            analysisId: payload.analysisId,
            status,
            totalFrames: payload.totalFrames,
            artifactStatus: payload.artifactStatus,
            expectedArtifacts: payload.expectedArtifacts,
            stages: payload.stages,
            childAnalyses: payload.childAnalyses
        });
    }, [trajectoryId, analyses]);

    const handleJobUpdated = useCallback((job: Job) => {
        const analysisId = resolveJobAnalysisId(job);
        if (!analysisId) return;

        patchAnalysisStatus({
            analysisId,
            trajectoryId: job.trajectoryId,
            status: job.status
        });
    }, [patchAnalysisStatus]);

    const handleAnalysisStatusChanged = useCallback((payload: AnalysisStatusSocketPayload) => {
        patchAnalysisStatus(payload);
        announceAnalysisStatus(payload);
    }, [patchAnalysisStatus, announceAnalysisStatus]);

    const handleAnalysisStageChanged = useCallback((payload: AnalysisStageSocketPayload) => {
        if (payload.trajectoryId !== trajectoryId) return;

        updateAnalysisExecutionCaches({
            analysisId: payload.analysisId,
            artifactStatus: payload.artifactStatus,
            expectedArtifacts: payload.expectedArtifacts,
            stages: payload.stages,
            childAnalyses: payload.childAnalyses
        });

        if (payload.expectedArtifacts?.some((artifact) => artifact.status === 'ready')) {
            void invalidateSceneArtifacts();
        }
    }, [trajectoryId]);

    const handleSceneArtifactUpserted = useCallback((payload: SceneArtifactUpsertedSocketPayload) => {
        if (payload.trajectoryId !== trajectoryId) return;
        void invalidateSceneArtifacts();
    }, [trajectoryId]);

    useSocketEvent(SOCKET_ANALYSIS_EVENTS.CREATED, handleAnalysisCreated, { enabled });
    useSocketEvent(SOCKET_ANALYSIS_EVENTS.DELETED, handleAnalysisDeleted, { enabled });
    useSocketEvent(SOCKET_TEAM_EVENTS.JOB_UPDATED, handleJobUpdated, { enabled });
    useSocketEvent(SOCKET_ANALYSIS_EVENTS.STATUS_CHANGED, handleAnalysisStatusChanged, { enabled });
    useSocketEvent(SOCKET_ANALYSIS_EVENTS.STAGE_CHANGED, handleAnalysisStageChanged, { enabled });
    useSocketEvent(SOCKET_SCENE_ARTIFACT_EVENTS.UPSERTED, handleSceneArtifactUpserted, { enabled });
};

export default useSidebarSceneSocketSync;
