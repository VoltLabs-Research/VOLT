interface MetricBarProps {
    value: number;
    maxValue?: number;
    segments?: number;
    color?: string;
    glow?: string;
}

const MetricBar = ({
    value,
    maxValue = 100,
    segments = 40,
    color = '#32D74B',
    glow
}: MetricBarProps) => {
    const filledSegments = Math.floor((value / maxValue) * segments);

    return (
        <div className='flex gap-[0.1rem] rounded-full overflow-hidden'
            style={{
                height: 6,
                backgroundColor: 'var(--color-border-soft)'
            }}
        >
            {Array.from({ length: segments }).map((_, i) => (
                <div className='rounded-full h-full flex-1'
                    key={i}
                    style={{
                        backgroundColor: i < filledSegments ? color : 'transparent',
                        boxShadow: i < filledSegments && i === filledSegments - 1 && glow ? glow : 'none',
                        opacity: i < filledSegments ? 1 : 0.3,
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                />
            ))}
        </div>
    );
};

export default MetricBar;
