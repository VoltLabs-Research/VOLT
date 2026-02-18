import Container from '@/shared/presentation/components/Container';
import './MetricBar.css';

interface MetricBarProps {
    value: number;
    maxValue?: number;
    segments?: number;
    color?: string;
    glow?: string;
};

const MetricBar = ({
    value,
    maxValue = 100,
    segments = 40,
    color = '#32D74B',
    glow
}: MetricBarProps) => {
    const filledSegments = Math.floor((value / maxValue) * segments);

    return (
        <Container className='d-flex gap-0125 metric-bar radius-full overflow-hidden'>
            {Array.from({ length: segments }).map((_, i) => (
                <div
                    key={i}
                    className='metric-bar-segment h-max flex-1 radius-full'
                    style={{
                        backgroundColor: i < filledSegments ? color : 'transparent',
                        boxShadow: i < filledSegments && i === filledSegments - 1 && glow ? glow : 'none',
                        opacity: i < filledSegments ? 1 : 0.3,
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                />
            ))}
        </Container>
    );
};

export default MetricBar;
