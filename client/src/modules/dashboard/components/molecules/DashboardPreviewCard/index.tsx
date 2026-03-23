import './DashboardPreviewCard.css';
import DashboardCard from '@/modules/dashboard/components/atoms/DashboardCard';
import useFractalSceneConfig from '@/modules/canvas/hooks/use-fractal-scene-config';
import useDashboardPreview from '@/modules/dashboard/hooks/use-dashboard-preview';
import SingleModelViewer from '@/modules/fractal/components/molecules/SingleModelViewer';
import FractalScene from '@/modules/fractal/components/organisms/FractalScene';
import type { ModelLoadingState } from '@/modules/fractal/api/entities/model';
import { DEFAULT_SLICE_PLANE_CONFIG } from '@/modules/fractal/utilities/slice-plane';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import EmptyState from '@/shared/presentation/components/EmptyState';
import Loader from '@/shared/presentation/components/Loader';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import { DEFAULT_SCENE } from '@/modules/fractal/utilities/scene-utils';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { getDefaultEffectsSettings } from '@/shared/domain/rendering/effects';
import { getDefaultEnvironmentSettings } from '@/shared/domain/rendering/environment';
import { DprMode } from '@/shared/domain/rendering/performance';
import { getDefaultLightsState } from '@/shared/domain/rendering/lights';
import { PrecisionType } from '@/shared/domain/rendering/renderer';
import { usePrefersReducedMotion } from '@/shared/presentation/hooks/use-prefers-reduced-motion';
import { formatNumber } from '@/shared/utils/format';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { GoArrowRight } from 'react-icons/go';
import { PiAtomThin } from 'react-icons/pi';
import { useShallow } from 'zustand/react/shallow';
import type { CSSProperties } from 'react';

const INITIAL_MODEL_LOADING_STATE: ModelLoadingState = {
    isLoading: false,
    progress: 0,
    error: null
};

const PREVIEW_SCENE_OPACITIES: Record<string, number> = {};

const DashboardPreviewCard = () => {
    const teamId = useSelectedTeamId();
    const prefersReducedMotion = usePrefersReducedMotion();
    const [modelLoadingState, setModelLoadingState] = useState<ModelLoadingState>(INITIAL_MODEL_LOADING_STATE);
    const {
        atomCount,
        completedTrajectory,
        hasPreviewData,
        isLoadingPreview,
        isLoadingTrajectories,
        openCanvas,
        previewBoxBounds,
        readyTrajectory,
        readyTimestep
    } = useDashboardPreview();

    const {
        pointSizeMultiplier
    } = useEditorStore(useShallow((s) => ({
        pointSizeMultiplier: s.pointSizeMultiplier
    })));

    const sceneConfig = useFractalSceneConfig();

    const previewConfig = useMemo(() => ({
        ...sceneConfig,
        activeScene: DEFAULT_SCENE,
        rendererCreate: {
            ...sceneConfig.rendererCreate,
            antialias: false,
            logarithmicDepthBuffer: false,
            preserveDrawingBuffer: false,
            precision: PrecisionType.Medium
        },
        rendererRuntime: {
            ...sceneConfig.rendererRuntime,
            shadowEnabled: false,
            shadowAutoUpdate: false,
            localClippingEnabled: false
        },
        effects: getDefaultEffectsSettings(),
        environment: getDefaultEnvironmentSettings(),
        lights: getDefaultLightsState(),
        grid: {
            ...sceneConfig.grid,
            enabled: false
        },
        orbitControls: {
            ...sceneConfig.orbitControls,
            target: [0, 0, 0] as [number, number, number],
            enablePan: false,
            enableZoom: false
        },
        slicePlaneConfig: DEFAULT_SLICE_PLANE_CONFIG,
        dpr: {
            ...sceneConfig.dpr,
            mode: DprMode.Fixed,
            fixed: 1,
            min: 0.75,
            max: 1,
            pixelated: true,
            snap: true,
            interactionMin: 0.75
        },
        performance: {
            current: 0.7,
            min: 0.25,
            max: 1,
            debounce: 120
        },
        adaptiveEventsEnabled: true,
        interactionDegradeEnabled: true
    }), [sceneConfig]);
    const overlayStyle: CSSProperties = {
        position: 'absolute',
        inset: 0,
        zIndex: 2,
        pointerEvents: 'none'
    };

    useEffect(() => {
        setModelLoadingState(INITIAL_MODEL_LOADING_STATE);
    }, [readyTrajectory?._id, readyTimestep]);

    const hasModelLoadError = Boolean(modelLoadingState.error);
    const isSceneLoading = modelLoadingState.isLoading;

    if (isLoadingTrajectories) {
        return (
            <DashboardCard className='dashboard-preview-card d-flex flex-center' isRelative={true} overflowHidden={true}>
                <Loader scale={0.4} />
            </DashboardCard>
        );
    }

    if (!completedTrajectory) {
        return (
            <DashboardCard className='dashboard-preview-card' isRelative={true} overflowHidden={true}>
                <EmptyState
                    icon={<PiAtomThin size={32} />}
                    title='Simulation Preview'
                    description='Upload and process a trajectory to preview atom counts, structure, and quick Canvas access directly from the dashboard.'
                />
            </DashboardCard>
        );
    }

    if (!isLoadingPreview && !hasPreviewData) {
        return (
            <DashboardCard className='dashboard-preview-card' isRelative={true} overflowHidden={true}>
                <EmptyState
                    icon={<PiAtomThin size={32} />}
                    title='Preview unavailable'
                    description='We could not load the latest scene preview right now. Open the trajectory in Canvas to inspect it with full controls.'
                />
            </DashboardCard>
        );
    }

    if (hasModelLoadError && readyTrajectory) {
        return (
            <DashboardCard className='dashboard-preview-card' isRelative={true} overflowHidden={true}>
                <RecoveryState
                    title='3D preview unavailable'
                    description='We could not load the latest GLB preview for this trajectory. Open it in Canvas to inspect it with full controls.'
                    tone={RecoveryStateTone.Error}
                    className='dashboard-card-state'
                    retryLabel='Open in Canvas'
                    onRetry={openCanvas}
                />
            </DashboardCard>
        );
    }

    return (
        <DashboardCard className='dashboard-preview-card' isRelative={true} overflowHidden={true}>
            {(isLoadingPreview || isSceneLoading) && (
                <Container className='d-flex flex-center w-max h-max p-absolute inset-0 z-10'>
                    <Loader scale={0.4} />
                </Container>
            )}

            <AnimatePresence>
                {readyTrajectory && (
                    <motion.div
                        initial={prefersReducedMotion ? false : { opacity: 0 }}
                        animate={prefersReducedMotion ? undefined : { opacity: 1 }}
                        exit={prefersReducedMotion ? undefined : { opacity: 0 }}
                        style={overlayStyle}
                    >
                        <Container className='dashboard-preview-overlay' />

                        <Container className='dashboard-preview-info' style={{ pointerEvents: 'auto' }}>
                            <span className='dashboard-preview-badge glass-bg'>
                                {readyTrajectory.name}
                            </span>
                            <span className='dashboard-preview-badge glass-bg'>
                                {formatNumber(atomCount)} atoms
                            </span>
                        </Container>

                        <Container className='dashboard-preview-action' style={{ pointerEvents: 'auto' }}>
                            <Button className='dashboard-preview-action-btn glass-bg' shape='pill' variant='outline' onClick={openCanvas} rightIcon={<GoArrowRight size={14} />}>
                                Open in Canvas
                            </Button>
                        </Container>
                    </motion.div>
                )}
            </AnimatePresence>

            <FractalScene
                config={previewConfig}
                showGizmo={false}
                showGrid={false}
            >
                {readyTrajectory && readyTimestep !== undefined && previewBoxBounds && (
                    <SingleModelViewer
                        teamId={teamId ?? undefined}
                        trajectoryId={readyTrajectory._id}
                        currentTimestep={readyTimestep}
                        sceneConfig={DEFAULT_SCENE}
                        slicePlaneConfig={DEFAULT_SLICE_PLANE_CONFIG}
                        boxBounds={previewBoxBounds}
                        pointSizeMultiplier={pointSizeMultiplier}
                        sceneOpacities={PREVIEW_SCENE_OPACITIES}
                        onLoadingStateChanged={setModelLoadingState}
                        autoFit
                        autoFitKeyOverride={readyTrajectory._id}
                    />
                )}
            </FractalScene>
        </DashboardCard>
    );
};

export default DashboardPreviewCard;
