import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrajectoryProcessingProgress } from '@/modules/trajectory/domain/entities';
import { getProgressStageLabel } from '../../../../domain/constants';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import Paragraph from '@/shared/presentation/components/Paragraph';
import './TrajectoryProgressViewer.css';

interface TrajectoryProgressViewerProps{
    progress: TrajectoryProcessingProgress | null | undefined;
    trajectoryName?: string;
};

const TrajectoryProgressViewer = memo(({ progress, trajectoryName }: TrajectoryProgressViewerProps) => {
    if(!progress || progress.stage === 'completed') return null;

    const panelVariants = {
        hidden: { opacity: 0, scale: 0.95, y: 10, filter: 'blur(4px)' },
        visible: {
            opacity: 1,
            scale: 1,
            y: 0,
            filter: 'blur(0px)',
            transition: { type: 'spring' as const, stiffness: 300, damping: 25, mass: 0.8 }
        },
        exit: {
            opacity: 0,
            scale: 0.95,
            y: 10,
            filter: 'blur(4px)',
            transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as const }
        }
    };

    const isError = progress.stage === 'failed';
    const stageLabel = getProgressStageLabel(progress.stage);

    return (
        <AnimatePresence mode='wait'>
            <motion.div
                key='trajectory-progress'
                variants={panelVariants}
                initial='hidden'
                animate='visible'
                exit='exit'
                className={`progress-panel p-fixed radius-md overflow-hidden ${isError ? 'error' : ''}`}
            >
                <Container className='d-flex column gap-075 p-1-5'>
                    <Container className='d-flex content-between items-start'>
                        <Container className='d-flex column gap-025'>
                            {trajectoryName && (
                                <Paragraph className='font-size-1 color-secondary font-weight-5'>{trajectoryName}</Paragraph>
                            )}
                            <Title className='font-size-4 font-weight-6 color-primary progress-stage-label'>{stageLabel}</Title>
                        </Container>
                        <Paragraph className={`font-size-6 font-weight-6 ${isError ? 'progress-percentage-error' : 'progress-percentage'}`}>
                            {progress.percentage}%
                        </Paragraph>
                    </Container>

                    <Container className='progress-bar-container radius-sm overflow-hidden'>
                        <motion.div
                            className={`progress-bar-fill radius-sm ${isError ? 'error' : ''}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${progress.percentage}%` }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                        />
                    </Container>

                    {progress.message && (
                        <Paragraph className='font-size-2 color-secondary progress-message'>{progress.message}</Paragraph>
                    )}

                    <Paragraph className='font-size-1 color-muted font-weight-5'>
                        Step {progress.step} of {progress.totalSteps}
                    </Paragraph>
                </Container>
            </motion.div>
        </AnimatePresence>
    );
});

TrajectoryProgressViewer.displayName = 'TrajectoryProgressViewer';

export default TrajectoryProgressViewer;
