import { Trajectory } from '@/modules/trajectory/domain/entities';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Button from '@/shared/presentation/components/Button';
import './TrajectoryListItem.css';

interface TrajectoryListItemProps{
    trajectory: Trajectory;
    isSelected: boolean;
    onSelect: () => void;
    onDelete: (e: React.MouseEvent) => void;
};

const TrajectoryListItem = ({ trajectory, isSelected, onSelect, onDelete }: TrajectoryListItemProps) => (
    <Container
        className={`d-flex items-center content-between p-05 radius-sm cursor-pointer trajectory-list-item ${isSelected ? 'is-selected' : ''}`}
        onClick={onSelect}
    >
        <Paragraph className='font-size-2 color-primary trajectory-list-item-name'>
            {trajectory.name}
        </Paragraph>
        <Button
            variant='ghost'
            intent='danger'
            size='sm'
            className='trajectory-list-item-delete'
            onClick={onDelete}
        >
            Delete
        </Button>
    </Container>
);

export default TrajectoryListItem;
