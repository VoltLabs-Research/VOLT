import { analysisQuery } from '@/modules/analysis/hooks/queries';
import { removeAnalysisCaches, snapshotAnalysisCaches, cancelAnalysisCacheQueries } from '@/modules/analysis/services/cache';
import {
    cancelSceneArtifactCacheQueries,
    invalidateSceneArtifacts,
    removeSceneArtifactsForAnalysisFromCache,
    snapshotSceneArtifactCaches
} from '@/modules/trajectory/hooks/scene-artifacts/queries';
import { DEFAULT_SCENE } from '@/modules/fractal/utils/scene-utils';
import { restoreQueryDataSnapshot } from '@/shared/query/cache-utils';
import { showPromise } from '@/shared/ui/hooks/toast';
import { useCallback } from 'react';
import { useEditorStore } from '@/modules/canvas/store/editor';

import type { RefObject } from 'react';
import type { QueryDataSnapshot } from '@/shared/query/cache-utils';
import type { SceneObjectType } from '@/modules/fractal/contracts/scene';
import type { SidebarSceneSectionSnapshot, SidebarSceneSectionState } from './use-sidebar-scene-section-state';

interface UseSidebarSceneAnalysisDeletionInput {
    selectedAnalysisIdRef: RefObject<string | undefined>;
    setAnalysisId: (analysisId?: string, options?: { replace?: boolean }) => void;
    sectionState: SidebarSceneSectionState;
}

interface DeleteAnalysisOptimisticContext {
    analysisSnapshot: QueryDataSnapshot;
    sceneArtifactSnapshot: QueryDataSnapshot;
    sectionSnapshot: SidebarSceneSectionSnapshot;
    selectedAnalysisIdSnapshot?: string;
    clearedSelectedAnalysis: boolean;
    editorSnapshot: {
        activeScene: SceneObjectType;
        activeScenes: SceneObjectType[];
    };
}

const sceneBelongsToAnalysis = (scene: SceneObjectType | null | undefined, analysisId: string): boolean => {
    return !!scene && scene.source !== 'default' && scene.analysisId === analysisId;
};

const removeAnalysisScenes = (analysisId: string): void => {
    const editorState = useEditorStore.getState();
    const remaining = editorState.activeScenes.filter((scene) => !sceneBelongsToAnalysis(scene, analysisId));
    const activeScenes = remaining.length > 0 ? remaining : [DEFAULT_SCENE];

    useEditorStore.setState({
        activeScene: sceneBelongsToAnalysis(editorState.activeScene, analysisId)
            ? activeScenes[0]
            : editorState.activeScene,
        activeScenes
    });
};

/**
 * Deletes an analysis optimistically: caches, scenes and sidebar state drop it
 * immediately and are restored from a snapshot if the request fails.
 */
const useSidebarSceneAnalysisDeletion = ({
    selectedAnalysisIdRef,
    setAnalysisId,
    sectionState
}: UseSidebarSceneAnalysisDeletionInput) => {
    const { forgetAnalysis, snapshot, restore } = sectionState;

    const applyDeletedAnalysisLocally = useCallback((analysisId: string) => {
        removeAnalysisCaches(analysisId);
        removeSceneArtifactsForAnalysisFromCache(analysisId);
        removeAnalysisScenes(analysisId);
        forgetAnalysis(analysisId);

        if (selectedAnalysisIdRef.current === analysisId) {
            setAnalysisId(undefined, { replace: true });
        }
    }, [forgetAnalysis, selectedAnalysisIdRef, setAnalysisId]);

    const deleteAnalysisMutation = analysisQuery.useDeleteMutation({
        onMutate: async (analysisId): Promise<DeleteAnalysisOptimisticContext> => {
            await Promise.all([
                cancelAnalysisCacheQueries(),
                cancelSceneArtifactCacheQueries()
            ]);

            const editorState = useEditorStore.getState();
            const context: DeleteAnalysisOptimisticContext = {
                analysisSnapshot: snapshotAnalysisCaches(),
                sceneArtifactSnapshot: snapshotSceneArtifactCaches(),
                sectionSnapshot: snapshot(),
                selectedAnalysisIdSnapshot: selectedAnalysisIdRef.current,
                clearedSelectedAnalysis: selectedAnalysisIdRef.current === analysisId,
                editorSnapshot: {
                    activeScene: editorState.activeScene,
                    activeScenes: editorState.activeScenes
                }
            };

            applyDeletedAnalysisLocally(analysisId);

            return context;
        },
        onError: (_error, _analysisId, context) => {
            // TanStack types the mutation context as `unknown`.
            const rollback = context as DeleteAnalysisOptimisticContext | undefined;
            if (!rollback) return;

            restoreQueryDataSnapshot(rollback.analysisSnapshot);
            restoreQueryDataSnapshot(rollback.sceneArtifactSnapshot);
            restore(rollback.sectionSnapshot);
            useEditorStore.setState(rollback.editorSnapshot);
            if (rollback.clearedSelectedAnalysis) {
                setAnalysisId(rollback.selectedAnalysisIdSnapshot, { replace: true });
            }
        },
        onSettled: () => {
            void analysisQuery.cache.invalidate();
            void invalidateSceneArtifacts();
        }
    });

    const deleteAnalysis = async (analysisId: string) => {
        await showPromise(
            deleteAnalysisMutation.mutateAsync(analysisId),
            {
                loading: { title: 'Deleting analysis...' },
                success: { title: 'Analysis deleted successfully' },
                error: { title: 'Failed to delete analysis' }
            }
        );
    };

    return {
        applyDeletedAnalysisLocally,
        deleteAnalysis
    };
};

export default useSidebarSceneAnalysisDeletion;
