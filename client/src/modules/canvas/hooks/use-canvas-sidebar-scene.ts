import { isSameScene, isSameSceneRenderMetadata } from '../utils/scene-identity';
import useExposureManager from './use-exposure-manager';
import useCanvasAnalysisStatus from './use-canvas-analysis-status';
import useSidebarSceneAnalysisDeletion from './use-sidebar-scene-analysis-deletion';
import useSidebarSceneExecutionNotifications from './use-sidebar-scene-execution-notifications';
import useSidebarSceneSectionState from './use-sidebar-scene-section-state';
import useSidebarSceneSocketSync from './use-sidebar-scene-socket-sync';
import {
    buildAnalysisSections,
    filterSectionsByTimestep,
    filterVisibleSections
} from '../utils/sidebar-scene-sections';
import {
    extractTrajectoryTimesteps,
    getNearestTimestep,
    getSelectedTimestepsForAnalysis
} from '../utils/selected-timestep-analysis';
import { useEditorStore } from '@/modules/canvas/store/editor';
import useCanvasUrlState from './use-canvas-url-state';
import { buildPluginScene, resolveExposureSceneRenderMetadata } from '../utils/plugin-exposure-export';

import { useAnalysesByTrajectoryQuery } from '@/modules/analysis/hooks/queries';
import { findCachedAnalysisById } from '@/modules/analysis/services/cache';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import { sileo } from 'sileo';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useAccessDenied from '@/shared/ui/hooks/use-access-denied';
import { usePendingPluginExecutionsStore } from '../store/use-pending-plugin-executions-store';
import { DEFAULT_SCENE } from '@/modules/fractal/utils/scene-utils';

import type { Analysis } from '@volt/contracts/modules/analysis/domain';
import type { RenderableExposure } from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import type { SceneObjectType } from '@/modules/fractal/contracts/scene';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';

interface UseCanvasSidebarSceneProps {
    trajectory?: Trajectory | null;
    trajectoryId?: string;
}

const scrollRightPanelToTop = (): (() => void) => {
    const raf = window.requestAnimationFrame(() => {
        const panel = document.getElementById('canvas-right-panel');
        const targets = [
            panel,
            panel?.querySelector<HTMLElement>('.canvas-objects-panel__top'),
            panel?.querySelector<HTMLElement>('.canvas-tree-container')
        ].filter((target): target is HTMLElement => Boolean(target));

        targets.forEach((target) => {
            target.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    });

    return () => window.cancelAnimationFrame(raf);
};

const useCanvasSidebarScene = ({ trajectory, trajectoryId: propTrajectoryId }: UseCanvasSidebarSceneProps) => {
    const { accessDenied, accessDeniedMessage, checkAccessDeniedError } = useAccessDenied();

    const trajectoryId = propTrajectoryId || trajectory?._id;

    const {
        setActiveScene,
        activeScene,
        addScene,
        removeScene,
        activeScenes,
        currentTimestep,
        setCurrentTimestep
    } = useEditorStore(useShallow((s) => ({
        setActiveScene: s.setActiveScene,
        activeScene: s.activeScene,
        addScene: s.addScene,
        removeScene: s.removeScene,
        activeScenes: s.activeScenes,
        currentTimestep: s.currentTimestep,
        setCurrentTimestep: s.setCurrentTimestep
    })));

    const { analysisId: analysisConfigId, setAnalysisId } = useCanvasUrlState();

    const { exposureEntries, getEntry, loadExposuresForAnalysis, resetEntries } = useExposureManager({ trajectoryId });
    const { getAnalysisStatus } = useCanvasAnalysisStatus({ trajectoryId, enabled: !!trajectoryId });
    const { pluginsById } = usePluginSelectors();
    const [searchQuery, setSearchQuery] = useState('');

    const sectionState = useSidebarSceneSectionState();
    const {
        expandedSections,
        headerPopoverStates,
        expandSection,
        toggleSection,
        setHeaderPopoverOpen,
        reset: resetSectionState
    } = sectionState;

    const selectedAnalysisIdRef = useRef<string | undefined>(analysisConfigId);
    useEffect(() => { selectedAnalysisIdRef.current = analysisConfigId; }, [analysisConfigId]);

    const activeSceneRef = useRef(activeScene);
    useEffect(() => { activeSceneRef.current = activeScene; }, [activeScene]);

    const manualSelectionRef = useRef<string | null>(null);

    const analysesQuery = useAnalysesByTrajectoryQuery(
        {
            trajectoryId: trajectoryId ?? '',
            page: 1,
            limit: 100
        },
        { enabled: !!trajectoryId }
    );

    const bootstrapLoading = analysesQuery.isLoading;
    const analysesData = analysesQuery.data?.data;
    const analyses = useMemo(() => analysesData ?? [], [analysesData]);

    const selectedAnalysis = useMemo(() => {
        if (!analysisConfigId) {
            return undefined;
        }

        return findCachedAnalysisById({
            analysisId: analysisConfigId,
            trajectoryId,
            fallbackAnalyses: analyses.length > 0 ? analyses : (trajectory?.analysis ?? [])
        });
    }, [analyses, analysisConfigId, trajectory?.analysis, trajectoryId]);

    const resolvedAnalyses = useMemo(() => {
        if (!selectedAnalysis || analyses.some((analysis) => analysis._id === selectedAnalysis._id)) {
            return analyses;
        }

        return [selectedAnalysis, ...analyses];
    }, [analyses, selectedAnalysis]);

    useEffect(() => {
        if (analysesQuery.error) {
            checkAccessDeniedError(analysesQuery.error);
        }
    }, [analysesQuery.error, checkAccessDeniedError]);

    useEffect(() => {
        resetSectionState();
        setSearchQuery('');
        resetEntries();
    }, [trajectoryId, resetSectionState, resetEntries]);

    useEffect(() => {
        if (!trajectoryId) {
            return;
        }
        return () => {
            const { entries } = usePendingPluginExecutionsStore.getState();
            Object.values(entries).forEach((entry) => {
                if (entry.trajectoryId !== trajectoryId) {
                    return;
                }
                if (entry.toastId) {
                    sileo.dismiss(entry.toastId);
                }
                usePendingPluginExecutionsStore.getState().remove(entry.analysisId);
            });
        };
    }, [trajectoryId]);

    const { applyDeletedAnalysisLocally, deleteAnalysis } = useSidebarSceneAnalysisDeletion({
        selectedAnalysisIdRef,
        setAnalysisId,
        sectionState
    });

    const { announceAnalysisStatus, clearAutoSelectChain } = useSidebarSceneExecutionNotifications({
        analyses: resolvedAnalyses,
        selectedAnalysisIdRef,
        setAnalysisId,
        setCurrentTimestep
    });

    useSidebarSceneSocketSync({
        trajectoryId,
        trajectoryName: trajectory?.name ?? '',
        analyses: resolvedAnalyses,
        applyDeletedAnalysisLocally,
        announceAnalysisStatus
    });

    useEffect(() => {
        if (!analysisConfigId) return;
        expandSection(analysisConfigId);
        loadExposuresForAnalysis(analysisConfigId);
        return scrollRightPanelToTop();
    }, [analysisConfigId, expandSection, loadExposuresForAnalysis]);

    useEffect(() => {
        if (resolvedAnalyses.length === 0) return;
        expandedSections.forEach((analysisId) => {
            if (!resolvedAnalyses.some((analysis) => analysis._id === analysisId)) return;
            const entry = getEntry(analysisId);
            if (entry.state === 'idle' || entry.state === 'error') {
                loadExposuresForAnalysis(analysisId);
            }
        });
    }, [expandedSections, resolvedAnalyses, getEntry, loadExposuresForAnalysis]);

    useEffect(() => {
        if (!analysisConfigId) return;

        const entry = getEntry(analysisConfigId);
        if (entry.state !== 'loaded') return;

        if (manualSelectionRef.current === analysisConfigId) {
            manualSelectionRef.current = null;
            return;
        }

        const plugin = selectedAnalysis?.plugin ? pluginsById[selectedAnalysis.plugin] : undefined;
        const buildSceneForExposure = (exposure: RenderableExposure) => buildPluginScene({
            analysisId: exposure.analysisId,
            exposureId: exposure.exposureId,
            sceneRenderMetadata: resolveExposureSceneRenderMetadata({
                exposureId: exposure.exposureId,
                exposureExport: exposure.export,
                plugin
            })
        });

        const currentScene = activeSceneRef.current;
        const { exposures } = entry;

        if (currentScene.source === 'plugin') {
            const match = exposures.find((exposure) => exposure.exposureId === currentScene.sceneType);
            if (match) {
                const nextScene = buildSceneForExposure(match);

                if (currentScene.analysisId === nextScene.analysisId
                    && currentScene.exposureId === nextScene.exposureId
                    && isSameSceneRenderMetadata(currentScene.sceneRenderMetadata, nextScene.sceneRenderMetadata)) {
                    return;
                }

                setActiveScene(nextScene);
                return;
            }
        }

        if (exposures.length > 0) {
            const primaryExposureId = selectedAnalysis?.expectedArtifacts?.find((artifact) => artifact.isPrimary)?.exposureId;
            setActiveScene(buildSceneForExposure(
                exposures.find((exposure) => exposure.exposureId === primaryExposureId) ?? exposures[0]
            ));
            return;
        }

        setActiveScene(DEFAULT_SCENE);
    }, [analysisConfigId, getEntry, pluginsById, selectedAnalysis, setActiveScene]);

    const trajectoryTimesteps = useMemo(() => extractTrajectoryTimesteps(trajectory), [trajectory]);

    const filteredSections = useMemo(() => {
        return filterVisibleSections(
            buildAnalysisSections(resolvedAnalyses, exposureEntries, analysisConfigId),
            analysisConfigId,
            searchQuery,
            getAnalysisStatus
        );
    }, [resolvedAnalyses, exposureEntries, analysisConfigId, searchQuery, getAnalysisStatus]);

    const sceneCollectionSections = useMemo(() => {
        return filterSectionsByTimestep(filteredSections, analysisConfigId, currentTimestep, trajectoryTimesteps);
    }, [filteredSections, analysisConfigId, currentTimestep, trajectoryTimesteps]);

    const isSceneInActiveScenes = useCallback((scene: SceneObjectType) => {
        return activeScenes.some((candidate) => isSameScene(candidate, scene));
    }, [activeScenes]);

    const prevTimestepRef = useRef(currentTimestep);
    const prevDeselectAnalysisIdRef = useRef(analysisConfigId);

    useEffect(() => {
        const previousTimestep = prevTimestepRef.current;
        const previousAnalysisId = prevDeselectAnalysisIdRef.current;
        prevTimestepRef.current = currentTimestep;
        prevDeselectAnalysisIdRef.current = analysisConfigId;

        if (currentTimestep === undefined) return;
        if (!selectedAnalysis) return;

        const scopedTimesteps = getSelectedTimestepsForAnalysis(selectedAnalysis, trajectoryTimesteps);
        if (!scopedTimesteps || scopedTimesteps.includes(currentTimestep)) return;

        if (previousAnalysisId !== analysisConfigId) {
            const nextTimestep = getNearestTimestep(currentTimestep, scopedTimesteps);
            if (nextTimestep !== undefined && nextTimestep !== currentTimestep) {
                setCurrentTimestep(nextTimestep);
            }
            return;
        }

        if (previousTimestep === currentTimestep) return;
        setActiveScene(DEFAULT_SCENE);
        setAnalysisId(undefined, { replace: true });
    }, [currentTimestep, analysisConfigId, selectedAnalysis, trajectoryTimesteps, setActiveScene, setAnalysisId, setCurrentTimestep]);

    const onSelectScene = useCallback((scene: SceneObjectType, analysis?: Analysis) => {
        clearAutoSelectChain();
        if (scene.source === 'plugin') {
            manualSelectionRef.current = scene.analysisId;
        }

        if (analysis?._id) {
            const selectedAnalysisTimesteps = getSelectedTimestepsForAnalysis(analysis, trajectoryTimesteps);
            const currentTimestepHasData = selectedAnalysisTimesteps === undefined
                || (currentTimestep !== undefined && selectedAnalysisTimesteps.includes(currentTimestep));

            if (!currentTimestepHasData) {
                const nextTimestep = getNearestTimestep(currentTimestep, selectedAnalysisTimesteps ?? trajectoryTimesteps);
                if (nextTimestep !== undefined && nextTimestep !== currentTimestep) {
                    setCurrentTimestep(nextTimestep);
                }
            }
        }

        setActiveScene(scene);
        setAnalysisId(analysis?._id, { replace: true });
    }, [clearAutoSelectChain, currentTimestep, setActiveScene, setAnalysisId, setCurrentTimestep, trajectoryTimesteps]);

    const headerPopoverCallbacks = useMemo(() => {
        const map = new Map<string, (isOpen: boolean) => void>();
        filteredSections.forEach((section) => {
            map.set(section.analysis._id, (isOpen: boolean) => {
                setHeaderPopoverOpen(section.analysis._id, isOpen);
            });
        });
        return map;
    }, [filteredSections, setHeaderPopoverOpen]);

    return {
        trajectoryId,
        searchQuery,
        setSearchQuery,
        expandedSections,
        analyses: resolvedAnalyses,
        headerPopoverStates,
        accessDenied,
        accessDeniedMessage,

        filteredSections,
        sceneCollectionSections,
        showSectionsSkeleton: bootstrapLoading,
        headerPopoverCallbacks,

        activeScene,
        addScene,
        removeScene,
        onSelectScene,
        isSceneInActiveScenes,

        toggleSection,
        onDeleteAnalysis: deleteAnalysis,
        onRetryLoadExposures: loadExposuresForAnalysis
    };
};

export default useCanvasSidebarScene;
