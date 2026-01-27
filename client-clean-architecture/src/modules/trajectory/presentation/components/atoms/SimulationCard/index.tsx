import React, { useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PiAtomThin, PiDotsThreeVerticalBold, PiImagesSquareThin } from 'react-icons/pi';
import { RxTrash } from "react-icons/rx";
import { HiOutlineViewfinderCircle, HiArrowDownTray } from "react-icons/hi2";
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import EditableTrajectoryName from '../EditableTrajectoryName';
import Popover from '@/shared/presentation/components/molecules/common/Popover';
import PopoverMenuItem from '@/shared/presentation/components/atoms/common/PopoverMenuItem';
import ProcessingLoader from '@/shared/presentation/components/atoms/common/ProcessingLoader';
import SimulationCardUsers from '../SimulationCardUsers';
import { useDeleteTrajectory, useTrajectory } from '@/modules/trajectory/presentation/hooks/use-trajectory-queries';
import useConfirm from '@/shared/presentation/hooks/ui/use-confirm';
import useCardInteractions from '@/shared/presentation/hooks/ui/interaction/use-card-interaction';
import useTrajectoryPreview from '@/modules/trajectory/presentation/hooks/use-trajectory-preview';
// import { useRasterStore } from '@/modules/raster/presentation/stores'; // TODO: Migrate raster store
import Container from '@/shared/presentation/components/primitives/Container';
import Paragraph from '@/shared/presentation/components/primitives/Paragraph';
import Tooltip from '@/shared/presentation/components/atoms/common/Tooltip';
import { getTrajectoryUseCases } from '@/modules/trajectory/application/registry';
import type { Trajectory } from '@/modules/trajectory/domain/entities';
import { useUIStore } from '@/shared/presentation/stores/slices/ui';
import './SimulationCard.css';

interface SimulationCardProps {
    trajectory: Trajectory;
    isSelected: boolean;
    onSelect: (id: string) => void;
}

type ProcessingStage = 'idle' | 'queued' | 'processing' | 'rendering' | 'completed' | 'failed' | 'analyzing';

const getMessageForStage = (stage: ProcessingStage): string => {
    switch (stage) {
        case 'idle': return '';
        case 'queued': return 'Queued...';
        case 'analyzing': return 'Analyzing...';
        case 'processing': return 'Processing frames...';
        case 'rendering': return 'Rendering...';
        case 'completed': return 'Complete';
        default: return 'Processing...';
    }
};

const getInitialsFromUser = (user: any): string => {
    if (!user || typeof user === 'string') return '?';
    if (user.firstName && user.lastName) {
        return (user.firstName[0] + user.lastName[0]).toUpperCase();
    }
    if (user.email) {
        const parts = user.email.split('@')[0].split('.');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return user.email[0].toUpperCase();
    }
    return '?';
};

const getUserDisplayName = (user: any): string => {
    if (!user || typeof user === 'string') return 'Unknown';
    if (user.firstName && user.lastName) {
        return `${user.firstName} ${user.lastName}`;
    }
    if (user.email) {
        return user.email.split('@')[0];
    }
    return 'Unknown';
};

const useTrajectoryProcessingStatus = ({ trajectoryId, initialData }: { trajectoryId: string; initialData: Trajectory }) => {
    const { data: traj } = useTrajectory(trajectoryId);
    const currentTraj = traj || initialData;
    const stage = (currentTraj?.status || 'idle') as ProcessingStage;

    return {
        isProcessing: currentTraj?.status !== 'completed' && currentTraj?.status !== undefined,
        message: getMessageForStage(stage)
    };
};

const SimulationCard: React.FC<SimulationCardProps> = memo(({
    trajectory,
    isSelected,
    onSelect
}) => {
    const navigate = useNavigate();
    const deleteMutation = useDeleteTrajectory();
    const { downloadTrajectoryDumpsUseCase } = getTrajectoryUseCases();
    // const rasterize = useRasterStore((state) => state.rasterize);
    const { confirm } = useConfirm();

    const {
        previewBlobUrl,
        isLoading: previewLoading,
        error: previewError,
        cleanup: cleanupPreview,
        retry: retryPreview
    } = useTrajectoryPreview({
        trajectoryId: trajectory._id,
        updatedAt: trajectory.updatedAt,
        enabled: trajectory.status === 'completed'
    });

    const processingStatus = useTrajectoryProcessingStatus({
        trajectoryId: trajectory._id,
        initialData: trajectory
    });

    const { isDeleting, handleClick, handleDelete } = useCardInteractions(
        onSelect,
        (id: string) => navigate(`/canvas/${id}/`),
        false
    );

    const [loadingAction, setLoadingAction] = React.useState<string | null>(null);

    const handleRasterize = useCallback(async () => {
        // TODO: Implement after raster store is migrated
        /*
        try {
            setLoadingAction('rasterize');
            if (rasterize) {
                await rasterize(trajectory._id);
            }
        } catch (error: any) {
            console.error('Rasterize failed:', error);
        } finally {
            setLoadingAction(null);
        }
        */
    }, [trajectory._id]);

    const isWaitingForProcess = trajectory.status === 'waiting_for_proccess';
    const showProcessingLoader = processingStatus.isProcessing || isWaitingForProcess;
    const containerClasses = `simulation-container ${showProcessingLoader ? 'has-jobs' : ''} ${isDeleting ? 'is-deleting' : ''} ${isSelected ? 'is-selected' : ''}`;

    const onDelete = async (): Promise<void> => {
        if (!await confirm(`Delete trajectory "${trajectory.name}"? This cannot be undone.`)) return;
        handleDelete(trajectory._id, async (id: string) => {
            await deleteMutation.mutateAsync(id);
        }, () => {
            cleanupPreview();
        });
    };

    const handleViewScene = (): void => {
        navigate(`/canvas/${trajectory._id}/`);
    };

    const handleDownload = useCallback(async () => {
        try {
            setLoadingAction('download');
            await downloadTrajectoryDumpsUseCase.execute(trajectory._id, trajectory.name);
            useUIStore.getState().addToast('Download started successfully', 'success');
        } catch (error: any) {
            console.error('Download failed:', error);
            useUIStore.getState().addToast('Failed to start download', 'error');
        } finally {
            setLoadingAction(null);
        }
    }, [downloadTrajectoryDumpsUseCase, trajectory._id, trajectory.name]);

    const shouldShowPreview = previewBlobUrl && !previewError;
    const shouldShowPlaceholder = !shouldShowPreview || previewLoading;

    return (
        <figure
            className={containerClasses}
            onClick={(e) => handleClick(e, trajectory._id)}
        >
            <Container className='container-content p-relative w-max h-max'>
                <Container className='d-flex flex-center overflow-hidden p-relative w-max simulation-cover-container'>
                    {shouldShowPlaceholder && (
                        <i className='d-flex flex-center w-max h-max color-muted simulation-cover-icon-container font-size-5-5'>
                            <PiAtomThin />
                        </i>
                    )}

                    {shouldShowPreview && (
                        <img
                            className='w-max h-max simulation-image'
                            src={previewBlobUrl}
                            alt={`Preview of ${trajectory.name || 'Trajectory'}`}
                            key={`${trajectory._id}-${trajectory.preview}-${trajectory.updatedAt}`}
                            onError={() => {
                                retryPreview();
                            }}
                        />
                    )}

                </Container>
            </Container>

            <motion.figcaption
                className='d-flex column gap-075 simulation-caption-container p-absolute'
                initial={false}
                whileHover="hover"
                animate="normal"
                variants={{
                    normal: { background: 'rgba(18, 18, 18, 0)' },
                    hover: { background: 'rgba(18, 18, 18, 0.45)' }
                }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            >
                {typeof trajectory?.createdBy === 'object' && trajectory.createdBy?.firstName && (
                    <motion.div
                        className='d-flex items-center simulation-caption-header p-relative'
                        variants={{
                            normal: { padding: 0 },
                            hover: { padding: '0.3rem 0.5rem' }
                        }}
                        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    >
                        <motion.div
                            className='d-flex items-center content-center simulation-user-avatar overflow-hidden f-shrink-0'
                            variants={{
                                normal: { scale: 0.8, opacity: 0.9 },
                                hover: { scale: 1, opacity: 1 }
                            }}
                            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                        >
                            <span className='avatar-initials font-size-1 font-weight-6 color-secondary'>
                                {trajectory.createdBy ? getInitialsFromUser(trajectory.createdBy) : '?'}
                            </span>
                        </motion.div>
                        <motion.div
                            className='d-flex column content-center simulation-user-info overflow-hidden'
                            variants={{
                                normal: { width: 0, opacity: 0, marginLeft: 0, scale: 0.8 },
                                hover: { width: 'auto', opacity: 1, marginLeft: '0.75rem', scale: 1 }
                            }}
                            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                        >
                            <span className='simulation-created-by font-weight-5 color-secondary'>Uploaded by</span>
                            <span className='simulation-user-name overflow-hidden font-weight-5 color-secondary'>
                                {getUserDisplayName(trajectory.createdBy)}
                            </span>
                        </motion.div>
                    </motion.div>
                )}
            </motion.figcaption>

            <div className='d-flex items-start gap-05 simulation-info-footer p-absolute'>
                <div className='d-flex column gap-05 simulation-caption-left-container w-max flex-1'>
                    <EditableTrajectoryName
                        trajectory={trajectory}
                        className='simulation-caption-title font-size-3 color-primary'
                    />

                    <div className='d-flex items-center gap-05 simulation-caption-left-bottom-container color-secondary'>
                        {showProcessingLoader ? (
                            <ProcessingLoader
                                message={processingStatus.message}
                                completionRate={0}
                                isVisible={true}
                            />
                        ) : (
                            <Paragraph className='simulation-last-edited overflow-hidden'>
                                Edited {formatDistanceToNow(new Date(trajectory.updatedAt), { addSuffix: true })}
                            </Paragraph>
                        )}
                    </div>
                </div>

                <Popover
                    id={`simulation-card-menu-${trajectory._id}`}
                    className='gap-1'
                    trigger={
                        <button className='simulation-options-icon-container color-primary cursor-pointer' style={{ background: 'transparent', border: 'none', padding: 0 }}>
                            <PiDotsThreeVerticalBold />
                        </button>
                    }
                >
                    <PopoverMenuItem
                        icon={<HiOutlineViewfinderCircle />}
                        onClick={handleViewScene}
                    >
                        View Scene
                    </PopoverMenuItem>
                    <PopoverMenuItem
                        icon={<HiArrowDownTray />}
                        onClick={handleDownload}
                        isLoading={loadingAction === 'download'}
                    >
                        Download Dumps
                    </PopoverMenuItem>
                    <PopoverMenuItem
                        icon={<PiImagesSquareThin />}
                        onClick={handleRasterize}
                        isLoading={loadingAction === 'rasterize'}
                    >
                        Rasterize
                    </PopoverMenuItem>
                    <PopoverMenuItem
                        icon={<RxTrash />}
                        onClick={onDelete}
                        variant="danger"
                        isLoading={isDeleting}
                    >
                        Delete
                    </PopoverMenuItem>
                </Popover>
            </div>

            <SimulationCardUsers trajectoryId={trajectory._id} />
        </figure>
    );
});

SimulationCard.displayName = 'SimulationCard';

export default SimulationCard;
