import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PiDotsThreeVerticalBold } from 'react-icons/pi';
import { RxTrash } from 'react-icons/rx';
import { HiOutlineViewfinderCircle } from 'react-icons/hi2';
import { formatDistanceToNow } from 'date-fns';
import EditableTrajectoryName from '../EditableTrajectoryName';
import useDeleteTrajectory from '../../../hooks/trajectory/use-delete-trajectory';
import useConfirm from '@/shared/presentation/hooks/use-confirm';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
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
};

const SimulationCardFooter = ({ 
    trajectoryId, 
    name, 
    updatedAt, 
    isProcessing, 
    processingMessage 
}: SimulationCardFooterProps) => {
    const navigate = useNavigate();
    const deleteTrajectory = useDeleteTrajectory();
    const { confirm } = useConfirm();
    const [isDeleting, setIsDeleting] = useState(false);

    const handleViewScene = useCallback(() => {
        navigate(`/canvas/${trajectoryId}/`);
    }, [navigate, trajectoryId]);

    const handleDelete = useCallback(async () => {
        if(!await confirm(`Delete trajectory "${name}"? This action cannot be undone.`)) return;
        setIsDeleting(true);
        try{
            await deleteTrajectory(trajectoryId);
        }finally{
            setIsDeleting(false);
        }
    }, [deleteTrajectory, confirm, trajectoryId, name]);

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
                <Container className='d-flex items-center gap-05 color-secondary font-size-2'>
                    {isProcessing ? (
                        <Paragraph className='color-muted'>{processingMessage}</Paragraph>
                    ) : (
                        <Paragraph>Edited {formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}</Paragraph>
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
