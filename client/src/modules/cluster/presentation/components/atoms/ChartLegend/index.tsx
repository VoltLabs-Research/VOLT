import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import './ChartLegend.css';

export interface LegendItem {
    label: string;
    color: string;
};

interface ChartLegendProps {
    items: LegendItem[];
    className?: string;
};

const ChartLegend = ({ items, className = '' }: ChartLegendProps) => (
    <Container className={`chart-legend d-flex content-center gap-1 f-shrink-0 ${className}`}>
        {items.map((item, index) => (
            <Container key={index} className='d-flex items-center gap-0375'>
                <Container
                    className='chart-legend-dot'
                    style={{ backgroundColor: item.color }}
                />
                <Paragraph className='chart-legend-label font-size-1 color-secondary'>
                    {item.label}
                </Paragraph>
            </Container>
        ))}
    </Container>
);

export default ChartLegend;
