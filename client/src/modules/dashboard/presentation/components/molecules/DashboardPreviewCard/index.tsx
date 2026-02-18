import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { motion, AnimatePresence } from 'framer-motion';
import { GoArrowRight } from 'react-icons/go';
import { PiAtomThin } from 'react-icons/pi';
import FractalScene from '@/modules/fractal/presentation/components/organisms/FractalScene';
import SingleModelViewer from '@/modules/fractal/presentation/components/molecules/SingleModelViewer';
import useFractalSceneConfig from '@/modules/canvas/presentation/hooks/use-fractal-scene-config';
import useCanvasCoordinator from '@/modules/canvas/presentation/hooks/use-canvas-coordinator';
import useFirstCompletedTrajectory from '@/modules/dashboard/presentation/hooks/use-first-completed-trajectory';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import { DEFAULT_SCENE } from '@/modules/fractal/presentation/utilities/sceneUtils';
import { formatNumber } from '@/shared/utils/format';
import Container from '@/shared/presentation/components/Container';
import Loader from '@/shared/presentation/components/Loader';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
import Button from '@/shared/presentation/components/Button';
import './DashboardPreviewCard.css';

const DashboardPreviewCard: React.FC = () => {
    const navigate = useNavigate();
    const { completedTrajectory, isLoadingTrajectories } = useFirstCompletedTrajectory();

    const {
        slicePlaneConfig,
        pointSizeMultiplier,
        sceneOpacities,
        activeModelBounds,
        setModelBounds,
        setIsModelLoading
    } = useEditorStore(useShallow((s) => ({
        slicePlaneConfig: s.configuration.slicePlaneConfig,
        pointSizeMultiplier: s.pointSizeMultiplier,
        sceneOpacities: s.sceneOpacities,
        activeModelBounds: s.activeModel?.modelBounds,
        setModelBounds: s.setModelBounds,
        setIsModelLoading: s.setIsModelLoading
    })));

    const { trajectory, currentTimestep, isLoading } = useCanvasCoordinator({
        trajectoryId: completedTrajectory?._id
    });

    const sceneConfig = useFractalSceneConfig();

    const previewConfig = useMemo(() => ({
        ...sceneConfig,
        orbitControls: {
            ...sceneConfig.orbitControls,
            enablePan: false,
            enableZoom: false
        }
    }), [sceneConfig]);

    const isReady = trajectory?._id && currentTimestep !== undefined && !isLoading;

    const atomCount = useMemo(() => {
        if (!trajectory?.frames || currentTimestep === undefined) return 0;
        const frame = trajectory.frames.find((f: any) => f.timestep === currentTimestep);
        return frame?.natoms ?? 0;
    }, [trajectory?.frames, currentTimestep]);

    const handleNavigateToCanvas = () => {
        if (trajectory?._id) {
            navigate(`/canvas/${trajectory._id}`);
        }
    };

    if (isLoadingTrajectories) {
        return (
            <Container className='dashboard-preview-card d-flex flex-center'>
                <Loader scale={0.4} />
            </Container>
        );
    }

    if (!completedTrajectory) {
        return (
            <Container className='dashboard-preview-card'>
                <Container className='dashboard-preview-empty'>
                    <PiAtomThin size={32} />
                    <span className='font-size-3 color-secondary font-weight-5'>Molecular Preview</span>
                    <span className='font-size-2 color-muted dashboard-preview-empty-text'>
                        Upload and process a trajectory file to see a real-time 3D visualization of your atomic structures here.
                    </span>
                </Container>
            </Container>
        );
    }

    return (
        <Container className='dashboard-preview-card'>
            {!isReady && (
                <Container className='d-flex flex-center w-max h-max p-absolute inset-0 z-10'>
                    <Loader scale={0.4} />
                </Container>
            )}

            <AnimatePresence>
                {isReady && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }}
                    >
                        <Container className='dashboard-preview-overlay' />

                        <Container className='dashboard-preview-info' style={{ pointerEvents: 'auto' }}>
                            <span className='dashboard-preview-badge'>
                                {trajectory.name}
                            </span>
                            <span className='dashboard-preview-badge'>
                                {formatNumber(atomCount)} atoms
                            </span>
                        </Container>

                        <Container className='dashboard-preview-action' style={{ pointerEvents: 'auto' }}>
                            <Button className='dashboard-preview-action-btn' shape='pill' onClick={handleNavigateToCanvas} rightIcon={<GoArrowRight size={14} />}>
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
                {isReady && (
                    <SingleModelViewer
                        trajectoryId={trajectory._id}
                        currentTimestep={currentTimestep}
                        sceneConfig={DEFAULT_SCENE}
                        slicePlaneConfig={slicePlaneConfig}
                        pointSizeMultiplier={pointSizeMultiplier}
                        sceneOpacities={sceneOpacities}
                        activeModelBounds={activeModelBounds}
                        onModelBoundsChanged={setModelBounds}
                        onLoadingStateChanged={setIsModelLoading}
                        autoFit={true}
                    />
                )}
            </FractalScene>
        </Container>
    );
};

export default DashboardPreviewCard;
