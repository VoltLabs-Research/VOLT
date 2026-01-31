import { memo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PiAtomThin, PiDotsThreeVerticalBold, PiImagesSquareThin } from 'react-icons/pi';
import { RxTrash } from 'react-icons/rx';
import { HiOutlineViewfinderCircle, HiArrowDownTray } from 'react-icons/hi2';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import type { Trajectory } from '../../../../domain/entities';
import { getStageMessage, isProcessingStatus } from '../../../../domain/constants';
import { getInitialsFromUser, getUserDisplayName } from '@/shared/utils/user';
import useDeleteTrajectory from '../../../hooks/trajectory/use-delete-trajectory';
import useTrajectoryPreview from '../../../hooks/trajectory/use-trajectory-preview';
import EditableTrajectoryName from '../../atoms/EditableTrajectoryName';
import SimulationCardUsers from '../../atoms/SimulationCardUsers';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';
import './SimulationCard.css';

interface SimulationCardProps{
    trajectory: Trajectory;
    isSelected: boolean;
    onSelect: (id: string) => void;
};

const SimulationCard = memo(({ trajectory, isSelected, onSelect }: SimulationCardProps) => {
    const navigate = useNavigate();
    const deleteTrajectory = useDeleteTrajectory();
    const [isDeleting, setIsDeleting] = useState(false);

    const {
        previewBlobUrl,
        isLoading: previewLoading,
        error: previewError,
        retry: retryPreview
    } = useTrajectoryPreview({
        trajectoryId: trajectory._id,
        version: trajectory.updatedAt,
        enabled: trajectory.status === 'completed'
    });

    const isProcessing = isProcessingStatus(trajectory.status);
    const processingMessage = getStageMessage(trajectory.status);
    const showLoader = isProcessing || trajectory.status === 'waiting_for_proccess';

    const containerClass = [
        'simulation-card radius-md b-soft p-relative',
        showLoader && 'has-jobs',
        isDeleting && 'is-deleting',
        isSelected && 'is-selected'
    ].filter(Boolean).join(' ');

    const handleClick = useCallback((e: React.MouseEvent) => {
        if(e.metaKey || e.ctrlKey){
            onSelect(trajectory._id);
        }else{
            navigate(`/canvas/${trajectory._id}/`);
        }
    }, [navigate, onSelect, trajectory._id]);

    const handleDelete = useCallback(async () => {
        setIsDeleting(true);
        try{
            await deleteTrajectory(trajectory._id);
        }finally{
            setIsDeleting(false);
        }
    }, [deleteTrajectory, trajectory._id]);

    const handleViewScene = useCallback(() => {
        navigate(`/canvas/${trajectory._id}/`);
    }, [navigate, trajectory._id]);

    const handleDownload = useCallback(() => {
        // TODO: Implement via use case
        console.log('Download trajectory:', trajectory._id);
    }, [trajectory._id]);

    const handleRasterize = useCallback(() => {
        // TODO: Implement via raster module
        console.log('Rasterize trajectory:', trajectory._id);
    }, [trajectory._id]);

    const showPreview = previewBlobUrl && !previewError;
    const showPlaceholder = !showPreview || previewLoading;

    const createdBy = typeof trajectory.createdBy === 'object' ? trajectory.createdBy : null;

    return (
        <Container className={containerClass} onClick={handleClick}>
            {/* Preview Area */}
            <Container className='d-flex flex-center overflow-hidden p-relative w-max cover-container radius-md'>
                {showPlaceholder && (
                    <Container className='d-flex flex-center w-max h-max color-muted font-size-5-5'>
                        <PiAtomThin />
                    </Container>
                )}
                {showPreview && (
                    <img
                        className='w-max h-max cover-image'
                        src={previewBlobUrl}
                        alt={`Preview of ${trajectory.name}`}
                        onError={() => retryPreview()}
                    />
                )}
            </Container>

            {/* User Header Overlay */}
            {createdBy?.firstName && (
                <motion.div
                    className='d-flex column gap-075 caption-overlay p-absolute'
                    initial={false}
                    whileHover='hover'
                    animate='normal'
                    variants={{
                        normal: { background: 'rgba(18, 18, 18, 0)' },
                        hover: { background: 'rgba(18, 18, 18, 0.45)' }
                    }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                >
                    <motion.div
                        className='d-flex items-center p-relative'
                        variants={{
                            normal: { padding: 0 },
                            hover: { padding: '0.3rem 0.5rem' }
                        }}
                        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    >
                        <motion.div
                            className='d-flex flex-center user-avatar radius-full overflow-hidden f-shrink-0'
                            variants={{
                                normal: { scale: 0.8, opacity: 0.9 },
                                hover: { scale: 1, opacity: 1 }
                            }}
                            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                        >
                            {createdBy.avatar ? (
                                <img src={createdBy.avatar} alt={getUserDisplayName(createdBy)} className='w-max h-max' />
                            ) : (
                                <Paragraph className='font-size-1 font-weight-6 color-secondary'>
                                    {getInitialsFromUser(createdBy)}
                                </Paragraph>
                            )}
                        </motion.div>
                        <motion.div
                            className='d-flex column content-center overflow-hidden'
                            variants={{
                                normal: { width: 0, opacity: 0, marginLeft: 0, scale: 0.8 },
                                hover: { width: 'auto', opacity: 1, marginLeft: '0.75rem', scale: 1 }
                            }}
                            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                        >
                            <Paragraph className='font-size-1 font-weight-5 color-secondary'>Uploaded by</Paragraph>
                            <Paragraph className='font-size-1 font-weight-5 color-secondary user-name'>
                                {getUserDisplayName(createdBy)}
                            </Paragraph>
                        </motion.div>
                    </motion.div>
                </motion.div>
            )}

            {/* Footer */}
            <Container className='d-flex items-start gap-05 card-footer p-absolute'>
                <Container className='d-flex column gap-05 flex-1'>
                    <EditableTrajectoryName
                        trajectoryId={trajectory._id}
                        name={trajectory.name}
                        className='font-size-3 color-primary font-weight-5'
                    />
                    <Container className='d-flex items-center gap-05 color-secondary font-size-2'>
                        {showLoader ? (
                            <Paragraph className='color-muted'>{processingMessage}</Paragraph>
                        ) : (
                            <Paragraph>Edited {formatDistanceToNow(new Date(trajectory.updatedAt), { addSuffix: true })}</Paragraph>
                        )}
                    </Container>
                </Container>

                <Popover
                    id={`simulation-card-popover-${trajectory._id}`}
                    trigger={
                        <button
                            className='options-btn color-primary cursor-pointer'
                            onClick={(e) => e.stopPropagation()}
                        >
                            <PiDotsThreeVerticalBold />
                        </button>
                    }
                >
                    <PopoverMenuItem icon={<HiOutlineViewfinderCircle />} onClick={handleViewScene} label='View Scene' />
                    <PopoverMenuItem icon={<HiArrowDownTray />} onClick={handleDownload} label='Download Dumps' />
                    <PopoverMenuItem icon={<PiImagesSquareThin />} onClick={handleRasterize} label='Rasterize' />
                    <PopoverMenuItem icon={<RxTrash />} onClick={handleDelete} variant='danger' label='Delete' />
                </Popover>
            </Container>

            <SimulationCardUsers trajectoryId={trajectory._id} />
        </Container>
    );
});

SimulationCard.displayName = 'SimulationCard';

export default SimulationCard;
