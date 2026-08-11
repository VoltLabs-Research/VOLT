import { cn } from '@heroui/react';
import type { ReactNode } from 'react';

interface TemplateCardProps {
    name: string;
    description: string;
    icon: ReactNode;
    isSelected: boolean;
    onClick: () => void;

    variant?: 'default' | 'custom';
}

const TemplateCard = ({
    name,
    description,
    icon,
    isSelected,
    onClick
}: TemplateCardProps) => (
    <button
        type='button'
        className={cn('relative cursor-pointer rounded-2xl border border-border bg-surface-secondary px-4 py-5 text-center transition-[border-color,box-shadow,transform,background-color] duration-150 ease-out hover:border-border-secondary hover:bg-surface-tertiary focus-visible:border-[var(--focus)] focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--focus)_25%,transparent)] focus-visible:outline-none', isSelected && 'border-accent shadow-[0_0_0_1px_var(--accent)]')}
        role='radio'
        aria-checked={isSelected}
        aria-label={`${name}${isSelected ? ', selected' : ''}`}
        onClick={onClick}
    >
        <div className='flex flex-col items-center gap-3 text-center'>
            <div className='inline-flex size-14 shrink-0 items-center justify-center rounded-xl border border-[color-mix(in_oklab,var(--info)_28%,transparent)] bg-info-soft text-foreground' aria-hidden='true'>{icon}</div>
            <h3 className='text-sm font-[550] text-foreground'>{name}</h3>
            <span className='text-xs leading-normal text-muted'>{description}</span>
        </div>
    </button>
);

export default TemplateCard;
