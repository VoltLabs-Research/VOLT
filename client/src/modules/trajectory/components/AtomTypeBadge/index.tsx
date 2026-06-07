import './AtomTypeBadge.css';
import { Box, StatusBadge } from '@voltstack/bravais';
interface AtomTypeBadgeProps {
    type: number | string;
}

const TYPE_PALETTE = [
    'var(--accent-blue)',
    'var(--accent-orange)',
    'var(--status-success)',
    'var(--status-error)',
    'var(--accent-purple)',
    'var(--accent-indigo)',
    'var(--color-text-secondary)',
    'var(--status-warning)'
];

const typeToColor = (t: number): string => {
    const type = Math.max(1, Math.floor(t));
    if(type <= TYPE_PALETTE.length) return TYPE_PALETTE[type - 1];
    const hue = ((type - 1) * 47) % 360;
    return `hsl(${hue}deg 60% 55%)`;
};

export default function AtomTypeBadge({ type }: AtomTypeBadgeProps) {
    const typeNumber = typeof type === 'number' ? type : Number(type);

    return (
        <StatusBadge variant='neutral'>
            <Box
                as='span'
                radius='full'
                className='atom-type-badge-color-indicator'
                style={{ backgroundColor: typeToColor(typeNumber) }}
            />
            {String(type)}
        </StatusBadge>
    );
}
