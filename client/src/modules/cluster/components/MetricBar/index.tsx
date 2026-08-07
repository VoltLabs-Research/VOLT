import { Box } from '@voltstack/bravais';
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
        <Box
            display='flex'
            gap='01'
            radius='full'
            overflow='hidden'
            style={{
                height: 6,
                backgroundColor: 'var(--color-border-soft)'
            }}
        >
            {Array.from({ length: segments }).map((_, i) => (
                <Box
                    key={i}
                    radius='full'
                    height='max'
                    flex='1'
                    style={{
                        backgroundColor: i < filledSegments ? color : 'transparent',
                        boxShadow: i < filledSegments && i === filledSegments - 1 && glow ? glow : 'none',
                        opacity: i < filledSegments ? 1 : 0.3,
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                />
            ))}
        </Box>
    );
};

export default MetricBar;
