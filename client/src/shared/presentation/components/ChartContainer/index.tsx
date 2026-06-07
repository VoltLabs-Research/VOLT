import './ChartContainer.css';
import { Box, Row, Stack, Heading, Text, Skeleton } from '@voltstack/bravais';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export type ChartStatEmphasis = 'primary' | 'secondary';

export interface ChartStat {
    label: string;
    value: string | number;
    emphasis?: ChartStatEmphasis;
};

interface ChartContainerProps {
    icon: LucideIcon | (() => ReactNode);
    title: string;
    isLoading: boolean;
    children: ReactNode;
    stats?: ChartStat[];
    statsLoading?: boolean;
};

const ChartContainer = ({
    icon: Icon,
    title,
    isLoading,
    children,
    stats,
    statsLoading = false
}: ChartContainerProps) => {
    const renderIcon = () => {
        if(typeof Icon === 'function' && !('$$typeof' in Icon)){
            return (Icon as () => ReactNode)();
        }
        const LucideIcon = Icon as LucideIcon;
        return <LucideIcon className='color-muted-foreground' style={{ width: 20, height: 20 }} />;
    };

    const renderStat = (stat: ChartStat) => {
        // Legacy default: treat stats without an emphasis flag as secondary
        // so old call sites keep their low-visual-weight behaviour.
        const emphasis: ChartStatEmphasis = stat.emphasis ?? 'secondary';
        const valueClassName = emphasis === 'primary'
            ? 'chart-stat-value chart-stat-value-primary'
            : 'chart-stat-value chart-stat-value-secondary';
        const skeletonWidth = emphasis === 'primary' ? 80 : 50;
        const skeletonHeight = emphasis === 'primary' ? 28 : 18;

        return (
            <Stack key={stat.label} gap='025'>
                <Text size='sm' className='chart-stat-label text-eyebrow'>
                    {stat.label}
                </Text>
                {statsLoading ? (
                    <Skeleton variant='text' width={skeletonWidth} height={skeletonHeight} />
                ) : (
                    <span className={valueClassName}>
                        {stat.value}
                    </span>
                )}
            </Stack>
        );
    };

    return (
        <Stack height='max' p='1-5' radius='lg' className='chart-container sm:p-1'>
            <Box display='flex' justify='between' mb='1-5' className='sm:column sm:gap-1'>
                <Row gap='075'>
                    {renderIcon()}
                    <Heading level={3} size='lg' weight='bold' className='chart-title'>
                        {title}
                    </Heading>
                </Row>
                {stats && (
                    <Row align='end' gap='1-5' wrap className='sm:w-max sm:gap-1'>
                        {stats.map(renderStat)}
                    </Row>
                )}
            </Box>

            {isLoading ? (
                <Skeleton
                    variant='rectangular'
                    width='100%'
                    height={280}
                    style={{ borderRadius: 8 }}
                />
            ) : (
                children
            )}
        </Stack>
    );
};

export default ChartContainer;
