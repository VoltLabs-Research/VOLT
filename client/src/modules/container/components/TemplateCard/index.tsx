import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

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
    <button
        type='button'
        className={`create-container-template-card ${variant} d-flex column gap-1 p-1 cursor-pointer radius-md ${isSelected ? 'selected' : ''}`}
        onClick={onClick}
        role='radio'
        aria-checked={isSelected}
        aria-label={`${name}${isSelected ? ', selected' : ''}`}
    >
        <div className='volt-container create-container-template-card-header d-flex items-start content-between gap-1'>
            <div className='volt-container create-container-template-icon d-flex flex-center f-shrink-0 radius-md'>
                {icon}
            </div>
            {isSelected && (
                <div className='volt-container create-container-template-selection-pill d-flex items-center gap-025 radius-full'>
                    <Check size={12} />
                    <span>Selected</span>
                </div>
            )}
        </div>
        <div className='volt-container create-container-template-info d-flex column gap-05'>
            <h3 className='volt-title font-size-3 font-weight-6'>{name}</h3>
            <p className='volt-text color-muted font-size-2'>{description}</p>
        </div>
    </button>
);

export default TemplateCard;
