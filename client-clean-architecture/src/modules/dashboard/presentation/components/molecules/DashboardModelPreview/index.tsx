import React, { useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GoArrowRight } from 'react-icons/go';
import FractalScene from '@/modules/fractal/presentation/components/organisms/FractalScene';
import SingleModelViewer from '@/modules/fractal/presentation/components/molecules/SingleModelViewer';
import useFractalSceneConfig from '@/modules/fractal/presentation/hooks/use-fractal-scene-config';
import useCanvasCoordinator from '@/modules/canvas/presentation/hooks/use-canvas-coordinator';
import useGetTrajectories from '@/modules/trajectory/presentation/hooks/trajectory/use-get-trajectories';
import JobsHistoryViewer from '@/modules/trajectory/presentation/components/organisms/JobsHistoryViewer';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import { DEFAULT_SCENE } from '@/modules/fractal/presentation/utilities/sceneUtils';
import { formatNumber } from '@/shared/utils/format';
import Container from '@/shared/presentation/components/Container';
import Loader from '@/shared/presentation/components/Loader';
import Title from '@/shared/presentation/components/Title';
import Paragraph from '@/shared/presentation/components/Paragraph';
import type { Trajectory } from '@/modules/trajectory/domain/entities';
import './DashboardModelPreview.css';

const DashboardModelPreview: React.FC = () => {
    const navigate = useNavigate();
    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    const getTrajectories = useGetTrajectories();
    const [completedTrajectory, setCompletedTrajectory] = useState<Trajectory | null>(null);
    const [isLoadingTrajectories, setIsLoadingTrajectories] = useState(true);

    useEffect(() => {
        if (!selectedTeam?._id) return;

        const fetchFirstCompleted = async () => {
            setIsLoadingTrajectories(true);
            try {
                const result = await getTrajectories({ page: 1, limit: 10 });
                const firstCompleted = result.data.find((t) => t.status === 'completed');
                setCompletedTrajectory(firstCompleted || null);
            } catch {
                setCompletedTrajectory(null);
            } finally {
                setIsLoadingTrajectories(false);
            }
        };

        fetchFirstCompleted();
    }, [selectedTeam?._id, getTrajectories]);

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
            <Container className='dashboard-model-preview w-max h-max d-flex flex-center'>
                <Loader scale={0.5} />
            </Container>
        );
    }

    if (!completedTrajectory) {
        return (
            <Container className='d-flex flex-center dashboard-canvas-overlay p-absolute inset-0 radius-lg'>
                <Container className='d-flex column gap-05 text-center'>
                    <Title className='font-size-5 color-primary font-weight-6'>Preview</Title>
                    <Paragraph className='color-secondary font-size-3 line-height-5 dashboard-overlay-description'>
                        Real-time visualization of atomic structures from your trajectory data will appear here once loaded.
                    </Paragraph>
                </Container>
            </Container>
        );
    }

    return (
        <Container className='dashboard-model-preview w-max h-max p-relative'>
            {!isReady && (
                <Container className='d-flex flex-center w-max h-max p-absolute inset-0 z-10'>
                    <Loader scale={0.5} />
                </Container>
            )}

            <AnimatePresence>
                {isReady && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className='preview-badges-container p-absolute inset-0 z-10'
                    >
                        <Container className='badge-container scene-preview-name-badge primary-surface p-absolute radius-full p-x-1 p-y-05'>
                            <Paragraph className='font-size-2 font-weight-5'>{trajectory.name}</Paragraph>
                        </Container>

                        <Container className='badge-container scene-preview-natoms-badge primary-surface p-absolute radius-full p-x-1 p-y-05'>
                            <Paragraph className='font-size-2 font-weight-5'>
                                {formatNumber(atomCount)} atoms
                            </Paragraph>
                        </Container>

                        <Container
                            className='badge-container scene-preview-navigate-icon primary-surface p-absolute radius-full p-05 font-size-5 d-flex flex-center cursor-pointer'
                            onClick={handleNavigateToCanvas}
                        >
                            <GoArrowRight />
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
                        autoFit={true}
                    />
                )}
            </FractalScene>

            <Container className='preview-jobs-container p-absolute left-1 bottom-1 z-10'>
                <JobsHistoryViewer hideAfterComplete={false} />
            </Container>
        </Container>
    );
};

export default React.memo(DashboardModelPreview);
