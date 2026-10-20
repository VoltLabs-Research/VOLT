interface AtomTypeBadgeProps {
    type: number | string;
}

const TYPE_PALETTE = [
    'var(--accent)',
    'var(--warning)',
    'var(--success)',
    'var(--danger)',
    'var(--accent-purple)',
    'var(--accent-indigo)',
    'var(--muted)',
    'var(--warning)'
];

const typeToColor = (t: number): string => {
    const type = Math.max(1, Math.floor(t));
    if(type <= TYPE_PALETTE.length) return TYPE_PALETTE[type - 1];
    const hue = ((type - 1) * 47) % 360;
    return `hsl(${hue}deg 60% 55%)`;
};

export default function AtomTypeBadge({ type }: AtomTypeBadgeProps) {
    const typeNumber = Number(type);

    return (
        <span className='inline-flex items-center gap-1 whitespace-nowrap rounded-full text-xs font-medium uppercase text-muted'>
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
