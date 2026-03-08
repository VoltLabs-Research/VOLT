import './AtomTypeBadge.css';
import StatusBadge from '@/shared/presentation/components/StatusBadge';

interface AtomTypeBadgeProps {
    type: number | string;
};

const TYPE_PALETTE = [
    '#1f77b4', 
    '#ff7f0e', 
    '#2ca02c', 
    '#d62728', 
    '#9467bd', 
    '#8c564b', 
    '#e377c2',
    '#7f7f7f', 
    '#bcbd22', 
    '#17becf', 
    '#aec7e8', 
    '#ffbb78', 
    '#98df8a', 
    '#ff9896',
    '#c5b0d5', 
    '#c49c94', 
    '#f7b6d2', 
    '#c7c7c7', 
    '#dbdb8d', 
    '#9edae5'
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
            <span 
                className='atom-type-badge-color-indicator radius-full'
                style={{ backgroundColor: typeToColor(typeNumber) }}
            />
            {String(type)}
        </StatusBadge>
    );
}
