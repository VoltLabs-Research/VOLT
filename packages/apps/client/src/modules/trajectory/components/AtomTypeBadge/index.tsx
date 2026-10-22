import { getCategoricalColorByIndex } from '@/shared/ui/utils/categorical-palette';

interface AtomTypeBadgeProps {
    type: number | string;
}

// The same palette as the plugin atoms table, so a type keeps its colour across the app.
export default function AtomTypeBadge({ type }: AtomTypeBadgeProps) {
    const typeNumber = Number(type);

    return (
        <span className='inline-flex items-center gap-1.5 whitespace-nowrap'>
            <span
                className='size-2.5 shrink-0 rounded-full'
                style={{ backgroundColor: Number.isFinite(typeNumber) ? getCategoricalColorByIndex(typeNumber) : 'var(--muted)' }}
            />
            {String(type)}
        </span>
    );
}
