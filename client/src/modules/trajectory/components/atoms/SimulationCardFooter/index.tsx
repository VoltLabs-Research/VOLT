import EditableTrajectoryName from '../EditableTrajectoryName';
import { trajectoryQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import { showPromise } from '@/shared/presentation/hooks/toast';
import IconButton from '@/shared/presentation/components/IconButton';
import Loader from '@/shared/presentation/components/Loader';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Container from '@/shared/presentation/components/Container';
import PopoverMenu from '@/shared/presentation/components/PopoverMenu';
import { ConfirmActionTone } from '@/shared/presentation/hooks/use-confirm';
import useConfirm from '@/shared/presentation/hooks/use-confirm';
import { formatDistanceToNow } from 'date-fns';
import { HiOutlineViewfinderCircle } from 'react-icons/hi2';
import { PiDotsThreeVerticalBold } from 'react-icons/pi';
import { RxTrash } from 'react-icons/rx';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';
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

        if (!isConfirmed) return;
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

    return (
        <Container className='simulation-card-footer z-10 p-1-5 d-flex items-center gap-05 p-absolute bottom-0 left-0 right-0'>
            <Container className='d-flex column gap-05 flex-1'>
                <EditableTrajectoryName
                    trajectoryId={trajectoryId}
                    name={name}
                    className='font-size-3 color-primary font-weight-5'
                />
                <Container className='simulation-card-metadata d-flex items-center gap-075 flex-wrap'>
                    <Paragraph className='simulation-card-status-text color-muted'>
                        {createdBy?.firstName ? `By ${createdBy.firstName} ${createdBy.lastName}` : 'Uploaded by team member'}
                    </Paragraph>
                    <Paragraph className='simulation-card-status-text color-muted'>
                        {frameCount} frames
                    </Paragraph>
                    <Paragraph className='simulation-card-status-text color-muted'>
                        {atomCount} atoms
                    </Paragraph>
                    <Paragraph className='simulation-card-status-text color-muted'>
                        {totalSize}
                    </Paragraph>
                </Container>
                <Container className='simulation-card-status d-flex items-center gap-075 color-secondary font-size-2'>
                    {isProcessing ? (
                        <>
                            <Loader scale={0.4} isFixed={false} className='simulation-card-status-loader f-shrink-0' />
                            <Paragraph className='simulation-card-status-text color-muted'>{processingMessage}</Paragraph>
                        </>
                    ) : (
                        <Paragraph className='simulation-card-status-text'>
                            Uploaded {formatDistanceToNow(new Date(createdAt), { addSuffix: true })} · Edited {formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}
                        </Paragraph>
                    )}
                </Container>
            </Container>

            <Popover
                id={`simulation-card-popover-${trajectoryId}`}
                trigger={
                    <IconButton
                        className='footer-options-btn'
                        title={`Open actions for ${name}`}
                        aria-label={`Open actions for ${name}`}
                    >
                        <PiDotsThreeVerticalBold />
                    </IconButton>
                }
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
