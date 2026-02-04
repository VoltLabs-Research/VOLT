import { X } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import IconButton from '@/shared/presentation/components/IconButton';
import useSelectionParams from '@/shared/presentation/hooks/use-selection-params';
import './ModifierHeader.css';

interface ModifierHeaderProps {
    title: string;
    modifierId: string;
    children?: React.ReactNode;
}

const ModifierHeader: React.FC<ModifierHeaderProps> = ({ title, modifierId, children }) => {
    const { toggleSelection } = useSelectionParams({ paramName: 'modifiers' });

    const handleClose = () => {
        toggleSelection(modifierId);
    };

    return (
        <Container className='d-flex content-between items-center w-max'>
            <Container className='d-flex items-center gap-05'>
                <Title className='font-weight-5-5'>{title}</Title>
                {children}
            </Container>
            <IconButton
                size='sm'
                variant='ghost'
                onClick={handleClose}
                className='modifier-header-close-btn'
                aria-label={`Close ${title}`}
            >
                <X size={16} />
            </IconButton>
        </Container>
    );
};

export default ModifierHeader;
