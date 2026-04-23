import type { ReactNode } from 'react';
import { SelectableCard } from '@/shared/presentation/primitives';

interface TemplateCardProps {
    name: string;
    description: string;
    icon: ReactNode;
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
    <SelectableCard
        className={`create-container-template-card ${variant}`}
        title={name}
        description={description}
        icon={icon}
        selected={isSelected}
        onSelect={onClick}
        selectionRole='radio'
        aria-label={`${name}${isSelected ? ', selected' : ''}`}
    />
);

export default TemplateCard;
