
import type { ContainerPortRelayTarget } from '@modules/container/services/ContainerPortProxyRelayService';
import type {
    ContainerAccessiblePort
} from '@volt/contracts/modules/container/domain';
import type {
    ContainerPortMapping,
    RuntimeContainerInfo
} from '@shared/contracts/ports/IContainerService';

export const PLACEHOLDER_INTERNAL_IP = '0.0.0.0';
const BROWSER_ACCESSIBLE_PORTS = new Set([80, 81, 3000, 3001, 4173, 4200, 5000, 5173, 5174, 8000, 8080, 8081, 8088, 8888, 8889]);

/* Port exposure and container IP resolution. Pure helpers: no persistence,
   no runtime calls, so they can be reasoned about in isolation. */

export const resolveAccessiblePorts = (ports: ContainerPortMapping[], containerStatus: string): ContainerAccessiblePort[] => {
    return ports.map((port) => ({
        private: port.private,
        public: port.public,
        protocol: 'tcp',
        browserAccessible: BROWSER_ACCESSIBLE_PORTS.has(port.private) || BROWSER_ACCESSIBLE_PORTS.has(port.public ?? 0),
        status: containerStatus === 'running' ? 'available' : 'unavailable'
    }));
};

/** Every published port of a container becomes one relay on the server. */
export const toRelayTargets = (
    target: Omit<ContainerPortRelayTarget, 'privatePort' | 'publicPort'>,
    ports: ContainerPortMapping[]
): ContainerPortRelayTarget[] => {
    return ports
        .filter((port) => (port.public ?? 0) > 0)
        .map((port) => ({
            ...target,
            privatePort: port.private,
            publicPort: port.public as number
        }));
};

/** Primary bridge address first, then every attached network, in declaration order. */
const collectInternalIps = (runtimeContainer: RuntimeContainerInfo): string[] => {
    const networks = Object.values(runtimeContainer.NetworkSettings?.Networks ?? {});
    return [runtimeContainer.NetworkSettings?.IPAddress, ...networks.map((endpoint) => endpoint?.IPAddress)]
        .filter((internalIp): internalIp is string => Boolean(internalIp));
};

export const resolveInternalIp = (runtimeContainer: RuntimeContainerInfo): string | undefined => {
    return collectInternalIps(runtimeContainer)[0];
};

export const resolveNonPlaceholderInternalIp = (runtimeContainer: RuntimeContainerInfo): string | undefined => {
    return collectInternalIps(runtimeContainer).find((internalIp) => internalIp !== PLACEHOLDER_INTERNAL_IP);
};
