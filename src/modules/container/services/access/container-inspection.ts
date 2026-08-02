import {
    READINESS_HTTP_PATH_LABEL_KEY,
    READINESS_HTTP_PORT_LABEL_KEY,
    READINESS_HTTP_QUERY_LABEL_KEY
} from '@shared/contracts/types/runtime-container';
import { isIP } from 'node:net';
import type { DockerRuntime } from '@shared/infrastructure/runtime/DockerRuntime';

type ContainerInspection = Awaited<ReturnType<DockerRuntime['getContainer']>>;

export interface ContainerReadinessProbe {
    path: string;
    query?: string;
    port?: number;
}

export const readPortSet = (value: string | undefined): Set<number> => {
    if (!value) {
        return new Set();
    }

    const ports = value
        .split(',')
        .map(Number)
        .filter((entry) => entry > 0);

    return new Set(ports);
};

export const readReadinessProbe = (labels: Record<string, string>): ContainerReadinessProbe | null => {
    const path = labels[READINESS_HTTP_PATH_LABEL_KEY]?.trim();
    if (!path) {
        return null;
    }

    const rawPort = Number(labels[READINESS_HTTP_PORT_LABEL_KEY]);
    return {
        path: path.startsWith('/') ? path : `/${path}`,
        query: labels[READINESS_HTTP_QUERY_LABEL_KEY]?.trim() || undefined,
        port: Number.isFinite(rawPort) && rawPort > 0 ? rawPort : undefined
    };
};

/** Prefers a routable IPv4 address on any attached network, falling back to IPv6. */
export const readInspectionInternalIp = (inspection: ContainerInspection): string | null => {
    const networks = Object.values(inspection.NetworkSettings.Networks);
    let ipv6Address: string | null = null;

    for (const network of networks) {
        if (isIP(network.IPAddress) !== 0) {
            return network.IPAddress;
        }

        if (!ipv6Address && isIP(network.GlobalIPv6Address) !== 0) {
            ipv6Address = network.GlobalIPv6Address;
        }
    }

    if (isIP(inspection.NetworkSettings.IPAddress) !== 0) {
        return inspection.NetworkSettings.IPAddress;
    }

    if (ipv6Address) {
        return ipv6Address;
    }

    if (isIP(inspection.NetworkSettings.GlobalIPv6Address) !== 0) {
        return inspection.NetworkSettings.GlobalIPv6Address;
    }

    return null;
};

export const readPublishedTcpPorts = (inspection: ContainerInspection): number[] => {
    const publishedPorts = inspection.NetworkSettings.Ports;
    const containerPorts: number[] = [];

    for (const [portDefinition, bindings] of Object.entries(publishedPorts)) {
        const [rawPort, protocol] = portDefinition.split('/');
        if (protocol !== 'tcp') {
            continue;
        }

        if (!bindings || bindings.length === 0) {
            continue;
        }

        const containerPort = Number(rawPort);
        if (containerPort <= 0) {
            continue;
        }

        containerPorts.push(containerPort);
    }

    return containerPorts;
};
