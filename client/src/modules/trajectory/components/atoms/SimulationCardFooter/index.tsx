import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PiDotsThreeVerticalBold } from 'react-icons/pi';
import { RxTrash } from 'react-icons/rx';
import { HiOutlineViewfinderCircle } from 'react-icons/hi2';
import { formatDistanceToNow } from 'date-fns';
import EditableTrajectoryName from '../EditableTrajectoryName';
import { trajectoryQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import useConfirm from '@/shared/presentation/hooks/use-confirm';
import { showPromise } from '@/shared/presentation/hooks/toast';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Loader from '@/shared/presentation/components/Loader';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';
import IconButton from '@/shared/presentation/components/IconButton';
import './SimulationCardFooter.css';

interface SimulationCardFooterProps{
    trajectoryId: string;
    name: string;
    updatedAt: string;
    isProcessing: boolean;
    processingMessage?: string;
    onDelete?: (_id: string) => void;
};

const SimulationCardFooter = ({ 
    trajectoryId, 
    name, 
    updatedAt, 
    isProcessing, 
    processingMessage,
    onDelete
}: SimulationCardFooterProps) => {
    const navigate = useNavigate();
    const deleteTrajectoryMutation = trajectoryQuery.useDeleteMutation();
    const { confirm } = useConfirm();
    const [isDeleting, setIsDeleting] = useState(false);

    const handleViewScene = useCallback(() => {
        navigate(`/canvas/${trajectoryId}/`);
    }, [navigate, trajectoryId]);

    const handleDelete = useCallback(async () => {
        if(!await confirm(`Delete trajectory "${name}"? This action cannot be undone.`)) return;
        setIsDeleting(true);
        try{
            onDelete?.(trajectoryId);
            await showPromise(
                deleteTrajectoryMutation.mutateAsync(trajectoryId),
                {
                    loading: { title: 'Deleting trajectory...' },
                    success: { title: 'Trajectory deleted' },
                    error: { title: 'Failed to delete trajectory' }
                }
            );
        }finally{
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
        <Container className='simulation-card-footer z-10 p-1-5 d-flex items-start gap-05 p-absolute bottom-0 left-0 right-0'>
            <Container className='d-flex column gap-05 flex-1'>
                <EditableTrajectoryName
                    trajectoryId={trajectoryId}
                    name={name}
                    className='font-size-3 color-primary font-weight-5'
                />
                <Container className='simulation-card-status d-flex items-center gap-075 color-secondary font-size-2'>
                    {isProcessing ? (
                        <>
                            <Loader scale={0.4} isFixed={false} className='simulation-card-status-loader f-shrink-0' />
                            <Paragraph className='simulation-card-status-text color-muted'>{processingMessage}</Paragraph>
                        </>
                    ) : (
                        <Paragraph className='simulation-card-status-text'>Edited {formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}</Paragraph>
                    )}
                </Container>
            </Container>

            <Popover
                id={`simulation-card-popover-${trajectoryId}`}
                trigger={
                    <IconButton
                        className='footer-options-btn'
                    >
                        <PiDotsThreeVerticalBold />
                    </IconButton>
                }
            >
                {popoverItems.map(({ Icon, onClick, label, ...props }, index) => (
                    <PopoverMenuItem
                        icon={<Icon />}
                        label={label}
                        onClick={onClick}
                        key={index}
                        {...props}
                    />
                ))}
            </Popover>
        </Container>
    );
};

export default SimulationCardFooter;
