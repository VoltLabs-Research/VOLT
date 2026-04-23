import { Stack, Row, Box, Text } from '@/shared/presentation/primitives';
import { usePrefersReducedMotion } from '@/shared/presentation/hooks/use-prefers-reduced-motion';
import type { ReactNode } from 'react';

interface DashboardClusterHealthGaugeProps {
    label: string;
    percent: number;
    icon: ReactNode;
    detail: string;
};

const GAUGE_RADIUS = 28;
const GAUGE_STROKE = 4;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;

const getGaugeColor = (percent: number): string => {
    if (percent >= 90) return 'var(--accent-red)';
    if (percent >= 70) return 'var(--accent-yellow, #f5a623)';
    return 'var(--accent-green)';
};

const DashboardClusterHealthGauge = ({ label, percent, icon, detail }: DashboardClusterHealthGaugeProps) => {
    const prefersReducedMotion = usePrefersReducedMotion();
    const clamped = Math.min(100, Math.max(0, percent));
    const offset = GAUGE_CIRCUMFERENCE - (clamped / 100) * GAUGE_CIRCUMFERENCE;
    const color = getGaugeColor(clamped);

    return (
        <Stack align='center' gap='05' className='cluster-gauge'>
            <Box display='flex' position='relative' className='cluster-gauge-ring flex-center'>
                <svg width={68} height={68} viewBox='0 0 68 68'>
                    <circle
                        cx='34'
                        cy='34'
                        r={GAUGE_RADIUS}
                        fill='none'
                        stroke='var(--color-border-soft)'
                        strokeWidth={GAUGE_STROKE}
                    />
                    <circle
                        cx='34'
                        cy='34'
                        r={GAUGE_RADIUS}
                        fill='none'
                        stroke={color}
                        strokeWidth={GAUGE_STROKE}
                        strokeLinecap='round'
                        strokeDasharray={GAUGE_CIRCUMFERENCE}
                        strokeDashoffset={offset}
                        transform='rotate(-90 34 34)'
                        className={prefersReducedMotion ? '' : 'cluster-gauge-progress'}
                    />
                </svg>
                <Box display='flex' position='absolute' className='cluster-gauge-center flex-center'>
                    <Text size='md' weight='bold' tone='primary'>
                        {Math.round(clamped)}%
                    </Text>
                </Box>
            </Box>

            <Row gap='025'>
                <Text className='cluster-gauge-icon' tone='muted'>{icon}</Text>
                <Text size='sm' weight='medium' tone='primary'>{label}</Text>
            </Row>
            <Text size='sm' tone='muted' className='cluster-gauge-detail'>{detail}</Text>
        </Stack>
    );
};

export default DashboardClusterHealthGauge;
