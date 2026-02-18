import Container from '@/shared/presentation/components/Container';
import { formatSize } from '@/shared/utils/format';
import type { Trajectory } from '@/modules/trajectory/domain/entities/Trajectory';
import './StatusBar.css';

type StatusItem = [label: string, value: string | number];

interface StatusBarProps {
    trajectory: Trajectory;
    currentTimestep: number;
}

const StatusGroup = ({ items }: { items: StatusItem[] }) => (
    <Container className="canvas-status-group d-flex items-center gap-05">
        {items.map(([label, value], i) => (
            <Container key={label} className="d-flex items-center gap-05">
                {i > 0 && <Container className="canvas-status-divider" />}
                <span className="font-size-05 color-muted">{label}{label && ': '}{value}</span>
            </Container>
        ))}
    </Container>
);

const StatusBar = ({ trajectory, currentTimestep }: StatusBarProps) => {
    const left: StatusItem[] = [
        ['Atoms', trajectory.frames[0].natoms],
        ['Frames', trajectory.frames.length],
        ['Size', formatSize(trajectory.stats.totalSize)]
    ];

    const right: StatusItem[] = [
        ['Timestep', currentTimestep],
        ['', trajectory?.team.name ?? '-']
    ];

    return (
        <Container className="canvas-status-bar d-flex items-center content-between">
            <Container className="d-flex items-center gap-05">
                <Container className="canvas-live-dot radius-full f-shrink-0" />
                <StatusGroup items={left} />
            </Container>
            <StatusGroup items={right} />
        </Container>
    );
};

export default StatusBar;
