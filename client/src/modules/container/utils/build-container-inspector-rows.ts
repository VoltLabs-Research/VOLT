import { format, formatDistanceStrict } from 'date-fns';
import { formatSize } from '@voltstack/bravais';
import type { Container } from '@volt/contracts/modules/container/domain';
import type { InspectorRow } from '../components/ContainerInspectorList';

const BYTES_PER_MB = 1024 * 1024;

/** The "Information" rows shown on the container overview. */
export const buildContainerInspectorRows = (container: Container): InspectorRow[] => {
    const isRunning = container.status === 'running';

    return [
        {
            label: 'Image',
            value: container.image,
            copyValue: container.image
        },
        {
            label: 'Container ID',
            value: container.containerId.substring(0, 12),
            copyValue: container.containerId
        },
        ...(container.internalIp
            ? [{
                label: 'Internal IP',
                value: container.internalIp,
                copyValue: container.internalIp
            }]
            : []),
        {
            label: 'CPU limit',
            value: `${container.cpus} ${container.cpus === 1 ? 'core' : 'cores'}`
        },
        {
            label: 'Memory limit',
            value: formatSize(container.memory * BYTES_PER_MB)
        },
        ...(container.network ? [{
            label: 'Network',
            value: container.network
        }] : []),
        ...(container.volume ? [{
            label: 'Volume',
            value: container.volume
        }] : []),
        {
            label: 'Created',
            value: format(new Date(container.createdAt), 'PP · p')
        },
        ...(isRunning
            ? [{
                label: 'Uptime',
                value: formatDistanceStrict(new Date(container.createdAt), new Date())
            }]
            : [])
    ];
};
