import { injectable } from 'tsyringe';
import type { ContainerAccessiblePort } from '@modules/container/domain/entities/Container';
import type { ContainerPortMapping } from '@modules/container/domain/port/IContainerService';

const BROWSER_ACCESSIBLE_PORTS = new Set([80, 81, 3000, 3001, 4173, 4200, 5000, 5173, 5174, 8000, 8080, 8081, 8088, 8888, 8889]);

const BROWSER_ACCESSIBLE_LABELS = [
    { pattern: /^https?$/i, label: 'http' },
    { pattern: /^web$/i, label: 'http' },
    { pattern: /^app$/i, label: 'http' },
    { pattern: /^ui$/i, label: 'http' },
    { pattern: /^dashboard$/i, label: 'http' },
    { pattern: /^jupyter$/i, label: 'http' }
] as const;

const normalizePortLabel = (value: unknown): string | null => {
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim().toLowerCase()
        : null;
};

const resolveBrowserAccessible = (port: ContainerPortMapping): boolean => {
    if (BROWSER_ACCESSIBLE_PORTS.has(port.private) || (typeof port.public === 'number' && BROWSER_ACCESSIBLE_PORTS.has(port.public))) {
        return true;
    }

    const label = normalizePortLabel((port as ContainerPortMapping & { label?: unknown }).label);
    if (!label) {
        return false;
    }

    return BROWSER_ACCESSIBLE_LABELS.some(({ pattern }) => pattern.test(label));
};

@injectable()
export class ContainerAccessiblePortResolver {
    resolve(
        _teamId: string,
        _containerId: string,
        ports: ContainerPortMapping[],
        containerStatus: string
    ): ContainerAccessiblePort[] {
        return ports.map((port) => {
            const status = containerStatus === 'running'
                ? 'available'
                : 'unavailable';
            const browserAccessible = resolveBrowserAccessible(port);

            return {
                private: port.private,
                public: port.public,
                protocol: 'tcp',
                browserAccessible,
                status
            };
        });
    }
}
