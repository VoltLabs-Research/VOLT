import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import './ChartTooltip.css';

export interface ChartTooltipItem {
    label: string;
    value: string | number;
    color?: string;
};

interface ChartTooltipProps {
    title?: string;
    items: ChartTooltipItem[];
};

const ChartTooltip = ({ title, items }: ChartTooltipProps) => (
    <Container className='chart-tooltip'>
        {title && (
            <Paragraph className='chart-tooltip-title font-size-2 font-weight-6 color-primary'>
                {title}
            </Paragraph>
        )}
        {items.map((item, index) => (
            <Paragraph
                key={index}
                className='chart-tooltip-item font-size-1'
                style={item.color ? { color: item.color } : undefined}
            >
                {item.label}: <strong>{item.value}</strong>
            </Paragraph>
        ))}
    </Container>
);

export default ChartTooltip;
