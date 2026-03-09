import Container from '@/shared/presentation/components/Container';

interface MetricBarsProps {
    percentage: number;
};

const MetricBars = ({ percentage }: MetricBarsProps) => {
    const activeBars = Math.floor(percentage / 20);

    return (
        <Container className='d-flex gap-01'>
            {[0, 1, 2, 3, 4].map((i) => (
                <Container
                    key={i}
                    className={`server-table-bar ${i < activeBars ? 'server-table-bar-active' : ''}`}
                />
            ))}
        </Container>
    );
};

export default MetricBars;
