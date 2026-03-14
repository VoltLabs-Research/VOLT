import EditableTrajectoryName from '../EditableTrajectoryName';
import { trajectoryQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import Container from '@/shared/presentation/components/Container';
import IconButton from '@/shared/presentation/components/IconButton';
import Loader from '@/shared/presentation/components/Loader';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenu from '@/shared/presentation/components/PopoverMenu';
import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { ConfirmActionTone } from '@/shared/presentation/hooks/use-confirm';
import useConfirm from '@/shared/presentation/hooks/use-confirm';
import { formatDistanceToNow } from 'date-fns';
import { HiOutlineViewfinderCircle } from 'react-icons/hi2';
import { PiDotsThreeVerticalBold } from 'react-icons/pi';
import { RxTrash } from 'react-icons/rx';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from '@/modules/auth/api/entities/user';
import './SimulationCardFooter.css';

interface SimulationCardFooterProps {
    trajectoryId: string;
    name: string;
    createdBy: User | null;
    createdAt: string;
    updatedAt: string;
    isProcessing: boolean;
    processingMessage?: string;
    atomCount: string;
    frameCount: string;
    totalSize: string;
    onDelete?: (_id: string) => void;
};

interface ToastState {
    title: string;
};

interface DeleteTrajectoryToastConfig {
    loading: ToastState;
    success: ToastState;
    error: ToastState;
};

const DELETE_TRAJECTORY_TOAST: DeleteTrajectoryToastConfig = {
    loading: { title: 'Deleting trajectory...' },
    success: { title: 'Trajectory deleted' },
    error: { title: 'Failed to delete trajectory' }
};

export default function SimulationCardFooter({
    trajectoryId,
    name,
    createdBy,
    createdAt,
    updatedAt,
    isProcessing,
    processingMessage,
    atomCount,
    frameCount,
    totalSize,
    onDelete
}: SimulationCardFooterProps) {
    const navigate = useNavigate();
    const deleteTrajectoryMutation = trajectoryQuery.useDeleteMutation();
    const { confirm } = useConfirm();
    const [isDeleting, setIsDeleting] = useState(false);
    const creatorLabel = createdBy?.firstName
        ? `By ${createdBy.firstName} ${createdBy.lastName}`.trim()
        : 'Uploaded by team member';
    const uploadedLabel = `Uploaded ${formatDistanceToNow(new Date(createdAt), { addSuffix: true })}`;
    const updatedLabel = `Edited ${formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}`;
    const activityLabel = `${uploadedLabel} · ${updatedLabel}`;

    const handleViewScene = useCallback(() => {
        navigate(`/canvas/${trajectoryId}/`);
    }, [navigate, trajectoryId]);

    const handleDelete = useCallback(async () => {
        const isConfirmed = await confirm({
            title: `Delete trajectory "${name}"?`,
            description: 'This permanently deletes the trajectory and cannot be undone.',
            confirmText: 'Delete trajectory',
            cancelText: 'Cancel',
            tone: ConfirmActionTone.Danger
        });

        if (!isConfirmed) {
            return;
        }

        setIsDeleting(true);

        try {
            onDelete?.(trajectoryId);
            await showPromise(
                deleteTrajectoryMutation.mutateAsync(trajectoryId),
                DELETE_TRAJECTORY_TOAST
            );
        } finally {
            setIsDeleting(false);
        }
    }, [deleteTrajectoryMutation, confirm, trajectoryId, name, onDelete]);

    const popoverItems = [{
        onClick: handleViewScene,
        label: 'View scene',
        Icon: HiOutlineViewfinderCircle
    }, {
        onClick: handleDelete,
        label: 'Delete',
        Icon: RxTrash,
        variant: 'danger' as const,
        isLoading: isDeleting
    }];

    const popoverTrigger = (
        <IconButton
            className='footer-options-btn'
            title={`Open actions for ${name}`}
            aria-label={`Open actions for ${name}`}
        >
            <PiDotsThreeVerticalBold />
        </IconButton>
    );

    return (
        <Container className='simulation-card-footer z-10 p-1-5 d-flex items-center gap-05 p-absolute bottom-0 left-0 right-0'>
            <Container className='d-flex column gap-05 flex-1'>
                <EditableTrajectoryName
                    trajectoryId={trajectoryId}
                    name={name}
                    className='simulation-card-title font-size-3 color-primary font-weight-5 text-truncate'
                />
                <Container className='simulation-card-metadata d-flex items-center gap-075 flex-wrap'>
                    <Paragraph className='simulation-card-status-text' title={creatorLabel}>
                        {creatorLabel}
                    </Paragraph>
                    <Paragraph className='simulation-card-status-text' title={`${frameCount} frames`}>
                        {frameCount} frames
                    </Paragraph>
                    <Paragraph className='simulation-card-status-text' title={`${atomCount} atoms`}>
                        {atomCount} atoms
                    </Paragraph>
                    <Paragraph className='simulation-card-status-text' title={totalSize}>
                        {totalSize}
                    </Paragraph>
                </Container>
                <Container className='simulation-card-status d-flex items-center gap-075 color-secondary font-size-2'>
                    {isProcessing ? (
                        <>
                            <Loader scale={0.4} isFixed={false} className='simulation-card-status-loader f-shrink-0' />
                            <Paragraph className='simulation-card-status-text' title={processingMessage}>
                                {processingMessage}
                            </Paragraph>
                        </>
                    ) : (
                        <Paragraph className='simulation-card-status-text' title={activityLabel}>
                            {activityLabel}
                        </Paragraph>
                    )}
                </Container>
            </Container>

            <Popover
                id={`simulation-card-popover-${trajectoryId}`}
                trigger={popoverTrigger}
            >
                <PopoverMenu>
                    {popoverItems.map(({ Icon, onClick, label, ...props }, index) => (
                        <PopoverMenuItem
                            icon={<Icon />}
                            label={label}
                            onClick={onClick}
                            key={index}
                            {...props}
                        />
                    ))}
                </PopoverMenu>
            </Popover>
        </Container>
    );
}
