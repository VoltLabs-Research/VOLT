import { Check } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import Paragraph from '@/shared/presentation/components/Paragraph';

interface TemplateCardProps {
    name: string;
    description: string;
    icon: React.ReactNode;
    isSelected: boolean;
    onClick: () => void;
    variant?: 'default' | 'custom';
};

const TemplateCard = ({
    name,
    description,
    icon,
    isSelected,
    onClick,
    variant = 'default'
}: TemplateCardProps) => (
    <button
        type='button'
        className={`create-container-template-card ${variant} d-flex column items-center gap-1 p-1 p-relative text-center cursor-pointer radius-md ${isSelected ? 'selected' : ''}`}
        onClick={onClick}
        aria-pressed={isSelected}
    >
        <Container className='create-container-template-icon d-flex flex-center f-shrink-0 radius-md'>
            {icon}
        </Container>
        <Container className='create-container-template-info d-flex column gap-05'>
            <Title className='font-size-3 font-weight-6'>{name}</Title>
            <Paragraph className='color-muted font-size-2'>{description}</Paragraph>
        </Container>
        {isSelected && (
            <Container className='create-container-selected-check d-flex flex-center p-absolute radius-full'>
                <Check size={16} />
            </Container>
        )}
    </button>
);

export default TemplateCard;
