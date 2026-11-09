import { cn } from '@heroui/react';

export interface CompositionPart {
    key: string;
    label: string;
    value: number;
    color: string;
}

interface CompositionBarProps {
    parts: CompositionPart[];
    height?: number;
    className?: string;
}

/* The iOS storage bar: one capsule, its segments split by hairline gaps. */
const CompositionBar = ({ parts, height = 6, className }: CompositionBarProps) => {
    const shown = parts.filter((part) => part.value > 0);
    if (shown.length === 0) return null;

    return (
        <div
            role='img'
            aria-label={shown.map((part) => `${part.label} ${part.value.toFixed(1)}%`).join(', ')}
            className={cn('flex w-full min-w-0 gap-0.5 overflow-hidden rounded-full', className)}
            style={{ height }}
        >
            {shown.map((part) => (
                <span key={part.key} className='block min-w-0.5' style={{ flex: `${part.value} 1 0`, background: part.color }} />
            ))}
        </div>
    );
};

export default CompositionBar;
