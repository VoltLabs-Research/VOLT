import Container from '@/shared/presentation/components/Container';
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
    const clamped = Math.min(100, Math.max(0, percent));
    const offset = GAUGE_CIRCUMFERENCE - (clamped / 100) * GAUGE_CIRCUMFERENCE;
    const color = getGaugeColor(clamped);

    return (
        <Container className='cluster-gauge d-flex column items-center gap-05'>
            <Container className='cluster-gauge-ring p-relative d-flex flex-center'>
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
                        className='cluster-gauge-progress'
                    />
                </svg>
                <Container className='cluster-gauge-center p-absolute d-flex flex-center'>
                    <span className='font-size-2 font-weight-6 color-primary'>
                        {Math.round(clamped)}%
                    </span>
                </Container>
            </Container>

            <Container className='d-flex items-center gap-025'>
                <span className='cluster-gauge-icon color-muted'>{icon}</span>
                <span className='font-size-1 font-weight-5 color-primary'>{label}</span>
            </Container>
            <span className='font-size-1 color-muted cluster-gauge-detail'>{detail}</span>
        </Container>
    );
};

export default DashboardClusterHealthGauge;
