import { formatSize } from '@voltstack/bravais';
import { Divider, Row, Text } from '@voltstack/bravais';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';
import type { ReactNode } from 'react';

import './StatusBar.css';

interface StatusItem {
    key: string;
    label: string;
    value: ReactNode;
    title?: string;
    className?: string;
}

interface StatusBarProps {
    trajectory: Trajectory | null | undefined;
    currentTimestep: number | undefined;
}

const StatusGroup = ({ items }: { items: StatusItem[] }) => (
    <Row gap='05' className="canvas-status-group">
        {items.map(({ key, label, value, title, className }, i) => (
            <Row key={key} gap='05' className="canvas-status-item">
                {i > 0 && <Divider orientation='vertical' className="canvas-status-divider" />}
                <Text as='span' size='sm' tone='muted' className={className} title={title}>
                    {label}{label && ': '}{value}
                </Text>
            </Row>
        ))}
    </Row>
);

const StatusBar = ({ trajectory, currentTimestep }: StatusBarProps) => {
    let teamName = '-';
    if (trajectory && typeof trajectory.team === 'object' && trajectory.team) {
        teamName = trajectory.team.name;
    }

    const atoms = trajectory?.frames?.[0]?.natoms ?? 0;
    const frames = trajectory?.frames?.length ?? 0;
    const size = trajectory?.stats?.totalSize !== undefined ? formatSize(trajectory.stats.totalSize) : '—';

    const left: StatusItem[] = [
        {
            key: 'atoms',
            label: 'Atoms',
            value: atoms
        },
        {
            key: 'frames',
            label: 'Frames',
            value: frames
        },
        {
            key: 'size',
            label: 'Size',
            value: size
        }
    ];

    const right: StatusItem[] = [
        {
            key: 'timestep',
            label: 'Timestep',
            value: currentTimestep ?? '—'
        },
        {
            key: 'team',
            label: '',
            value: teamName
        }
    ];

    return (
        <Row justify='between' className="canvas-status-bar">
            <Row gap='05' className="canvas-status-main">
                <StatusGroup items={left} />
            </Row>
            <StatusGroup items={right} />
        </Row>
    );
};

export default StatusBar;
