import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TrajectoryProcessingProgress } from '@/types/models';
import Container from '@/components/primitives/Container';
import './TrajectoryProgressViewer.css';

interface TrajectoryProgressViewerProps {
    progress: TrajectoryProcessingProgress | null | undefined;
    trajectoryName?: string;
}

const STAGE_LABELS: Record<string, string> = {
    parsing: 'Parsing Files',
    processing: 'Processing Frames',
    uploading: 'Uploading to Cloud',
    rasterizing: 'Generating Previews',
    completed: 'Completed',
    failed: 'Failed'
};

const TrajectoryProgressViewer: React.FC<TrajectoryProgressViewerProps> = memo(({ progress, trajectoryName }) => {
    if (!progress || progress.stage === 'completed') return null;

    const panelVariants = {
        hidden: { opacity: 0, scale: 0.95, y: 10, filter: 'blur(4px)' },
        visible: {
            opacity: 1, scale: 1, y: 0, filter: 'blur(0px)',
            transition: { type: 'spring' as const, stiffness: 300, damping: 25, mass: 0.8 }
        },
        exit: {
            opacity: 0, scale: 0.95, y: 10, filter: 'blur(4px)',
            transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as const }
        }
    };

    const isError = progress.stage === 'failed';
    const stageLabel = STAGE_LABELS[progress.stage] || progress.stage.toUpperCase();

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key="trajectory-progress"
                variants={panelVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className={`trajectory-progress-panel ${isError ? 'error' : ''}`}
            >
                <Container className="trajectory-progress-content">
                    <div className="progress-header">
                        <div className="progress-title">
                            {trajectoryName && <span className="trajectory-name">{trajectoryName}</span>}
                            <h4 className="stage-label">{stageLabel}</h4>
                        </div>
                        <span className="progress-percentage">{progress.percentage}%</span>
                    </div>

                    <div className="progress-bar-container">
                        <motion.div
                            className={`progress-bar-fill ${isError ? 'error' : ''}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${progress.percentage}%` }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                        />
                    </div>

                    {progress.message && (
                        <p className="progress-message">{progress.message}</p>
                    )}

                    <p className="progress-stats">
                        Step {progress.currentStep} of {progress.totalSteps}
                    </p>
                </Container>
            </motion.div>
        </AnimatePresence>
    );
});

TrajectoryProgressViewer.displayName = 'TrajectoryProgressViewer';

export default TrajectoryProgressViewer;
