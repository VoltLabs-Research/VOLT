import './DashboardPreviewCard.css';
import useFractalSceneConfig from '@/modules/canvas/hooks/use-fractal-scene-config';
import useDashboardPreview from '@/modules/dashboard/hooks/use-dashboard-preview';
import SingleModelViewer from '@/modules/fractal/components/molecules/SingleModelViewer';
import FractalScene from '@/modules/fractal/components/organisms/FractalScene';
import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import EmptyState from '@/shared/presentation/components/EmptyState';
import Loader from '@/shared/presentation/components/Loader';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import { DEFAULT_SCENE } from '@/modules/fractal/utilities/scene-utils';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { formatNumber } from '@/shared/utils/format';
import { AnimatePresence, motion } from 'framer-motion';
import { useMemo } from 'react';
import { GoArrowRight } from 'react-icons/go';
import { PiAtomThin } from 'react-icons/pi';
import { useShallow } from 'zustand/react/shallow';
import type { CSSProperties } from 'react';

const DashboardPreviewCard = () => {
    const teamId = useSelectedTeamId();
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
    const overlayStyle: CSSProperties = {
        position: 'absolute',
        inset: 0,
        zIndex: 2,
        pointerEvents: 'none'
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
                        style={overlayStyle}
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
                            <Button className='dashboard-preview-action-btn' shape='pill' onClick={openCanvas} rightIcon={<GoArrowRight size={14} />}>
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
