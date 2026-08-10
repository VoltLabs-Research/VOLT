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

/**
 * bravais's `StatusBadge` at `variant='neutral'`, rebuilt as the span it actually was.
 *
 * Two properties are easy to lose and are the whole look: `text-transform: uppercase`,
 * which the component applied in CSS rather than to the DOM text, and the *absence* of any
 * background or border — every variant was coloured uppercase text only, despite carrying
 * `rounded-full`. A HeroUI `Chip` would add a pill fill that was never there. `text-sm`
 * meant 0.75rem under bravais's scale, which is stock Tailwind's `text-xs`.
 */
const BADGE = 'inline-flex items-center gap-1 whitespace-nowrap rounded-full text-xs font-medium uppercase text-muted';

const typeToColor = (t: number): string => {
    const type = Math.max(1, Math.floor(t));
    if(type <= TYPE_PALETTE.length) return TYPE_PALETTE[type - 1];
    const hue = ((type - 1) * 47) % 360;
    return `hsl(${hue}deg 60% 55%)`;
};

export default function AtomTypeBadge({ type }: AtomTypeBadgeProps) {
    const typeNumber = Number(type);

    return (
        <span className={BADGE}>
            <span className='rounded-full'
                style={{
                    width: 9,
                    height: 9,
                    display: 'inline-block',
                    backgroundColor: typeToColor(typeNumber)
                }}
            />
            {String(type)}
        </span>
    );
}
