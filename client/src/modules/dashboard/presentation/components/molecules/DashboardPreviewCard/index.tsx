import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { motion, AnimatePresence } from 'framer-motion';
import { GoArrowRight } from 'react-icons/go';
import { PiAtomThin } from 'react-icons/pi';
import FractalScene from '@/modules/fractal/presentation/components/organisms/FractalScene';
import SingleModelViewer from '@/modules/fractal/presentation/components/molecules/SingleModelViewer';
import useFractalSceneConfig from '@/modules/canvas/presentation/hooks/use-fractal-scene-config';
import useFirstCompletedTrajectory from '@/modules/dashboard/presentation/hooks/use-first-completed-trajectory';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import { getFrameBoxBounds, getTrajectoryFrameByTimestep } from '@/modules/fractal/presentation/utilities/frameBoxBounds';
import type { Trajectory, TimestepInfo } from '@/modules/trajectory/domain/entities';
import useTrajectoryUseCases from '@/modules/trajectory/presentation/hooks/trajectory/use-trajectory-services';
import { DEFAULT_SCENE } from '@/modules/fractal/presentation/utilities/sceneUtils';
import { formatNumber } from '@/shared/utils/format';
import Container from '@/shared/presentation/components/Container';
import Loader from '@/shared/presentation/components/Loader';
import Button from '@/shared/presentation/components/Button';
import EmptyState from '@/shared/presentation/components/EmptyState';
import './DashboardPreviewCard.css';

const DashboardPreviewCard: React.FC = () => {
    const navigate = useNavigate();
    const { completedTrajectory, isLoadingTrajectories } = useFirstCompletedTrajectory();
    const { trajectoryRepository } = useTrajectoryUseCases();
    const [trajectory, setTrajectory] = useState<Trajectory | null>(null);
    const [currentTimestep, setCurrentTimestep] = useState<number | undefined>(undefined);
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);

    const {
        slicePlaneConfig,
        pointSizeMultiplier,
        sceneOpacities
    } = useEditorStore(useShallow((s) => ({
        slicePlaneConfig: s.configuration.slicePlaneConfig,
        pointSizeMultiplier: s.pointSizeMultiplier,
        sceneOpacities: s.sceneOpacities
    })));

    const sceneConfig = useFractalSceneConfig();

    const previewConfig = useMemo(() => ({
        ...sceneConfig,
        orbitControls: {
            ...sceneConfig.orbitControls,
            enablePan: false,
            enableZoom: false
        }
    }), [sceneConfig]);

    useEffect(() => {
        if (!completedTrajectory?._id) {
            setTrajectory(null);
            setCurrentTimestep(undefined);
            setIsLoadingPreview(false);
            return;
        }

        let isCancelled = false;

        setTrajectory(null);
        setCurrentTimestep(undefined);
        setIsLoadingPreview(true);

        const fetchPreviewTrajectory = async (): Promise<void> => {
            try {
                const result = await trajectoryRepository.getById(completedTrajectory._id);

                if (isCancelled) {
                    return;
                }

                setTrajectory(result);

                const timesteps = result.frames.map((frame: TimestepInfo) => frame.timestep);

                if (timesteps.length > 0) {
                    setCurrentTimestep(Math.min(...timesteps));
                } else {
                    setCurrentTimestep(undefined);
                }
            } catch {
                if (isCancelled) {
                    return;
                }

                setTrajectory(null);
                setCurrentTimestep(undefined);
            } finally {
                if (!isCancelled) {
                    setIsLoadingPreview(false);
                }
            }
        };

        void fetchPreviewTrajectory();

        return () => {
            isCancelled = true;
        };
    }, [completedTrajectory?._id, trajectoryRepository]);

    const hasPreviewData = Boolean(trajectory?._id) && currentTimestep !== undefined;
    const isReady = hasPreviewData && !isLoadingPreview;
    const readyTrajectory = isReady ? trajectory : null;
    const readyTimestep = isReady ? currentTimestep : undefined;
    const previewFrame = useMemo(() => {
        return getTrajectoryFrameByTimestep(trajectory, currentTimestep);
    }, [trajectory, currentTimestep]);
    const previewBoxBounds = useMemo(() => {
        if (!previewFrame) {
            return null;
        }

        return getFrameBoxBounds(previewFrame);
    }, [previewFrame]);

    const atomCount = useMemo(() => {
        if (!previewFrame) {
            return 0;
        }

        return previewFrame.natoms;
    }, [previewFrame]);

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
                <EmptyState
                    icon={<PiAtomThin size={32} />}
                    title='Simulation Preview'
                    description='Upload and process a trajectory file to see a real-time 3D visualization of your atomic structures here.'
                />
            </Container>
        );
    }

    if (!isLoadingPreview && !hasPreviewData) {
        return (
            <Container className='dashboard-preview-card'>
                <EmptyState
                    icon={<PiAtomThin size={32} />}
                    title='Preview unavailable'
                    description='We could not load the latest simulation preview right now. Please try opening the trajectory in Canvas.'
                />
            </Container>
        );
    }

    return (
        <Container className='dashboard-preview-card'>
            {isLoadingPreview && (
                <Container className='d-flex flex-center w-max h-max p-absolute inset-0 z-10'>
                    <Loader scale={0.4} />
                </Container>
            )}

            <AnimatePresence>
                {readyTrajectory && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }}
                    >
                        <Container className='dashboard-preview-overlay' />

                        <Container className='dashboard-preview-info' style={{ pointerEvents: 'auto' }}>
                            <span className='dashboard-preview-badge'>
                                {readyTrajectory.name}
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
                {readyTrajectory && readyTimestep !== undefined && previewBoxBounds && (
                    <SingleModelViewer
                        trajectoryId={readyTrajectory._id}
                        currentTimestep={readyTimestep}
                        sceneConfig={DEFAULT_SCENE}
                        slicePlaneConfig={slicePlaneConfig}
                        boxBounds={previewBoxBounds}
                        pointSizeMultiplier={pointSizeMultiplier}
                        sceneOpacities={sceneOpacities}
                        autoFit={true}
                    />
                )}
            </FractalScene>
        </Container>
    );
};

export default DashboardPreviewCard;
