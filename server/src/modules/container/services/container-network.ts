
import Container from '@modules/container/models/Container';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type {
    ContainerAccessiblePort
} from '@volt/contracts/modules/container/domain';
import type {
    ContainerEnvironmentVariable,
    ContainerPortMapping,
    RuntimeContainerInfo
} from '@shared/contracts/ports/IContainerService';

const PLACEHOLDER_INTERNAL_IP = '0.0.0.0';
const BROWSER_ACCESSIBLE_PORTS = new Set([80, 81, 3000, 3001, 4173, 4200, 5000, 5173, 5174, 8000, 8080, 8081, 8088, 8888, 8889]);
const BROWSER_ACCESSIBLE_LABELS = [/^https?$/i, /^web$/i, /^app$/i, /^ui$/i, /^dashboard$/i, /^jupyter$/i];

/* Port exposure and container IP resolution. Pure helpers: no persistence,
   no runtime calls, so they can be reasoned about in isolation. */

export const clusterId = (container: Container): string | undefined => {
    return container.teamCluster || undefined;
};

export const resolveAccessiblePorts = (ports: ContainerPortMapping[], containerStatus: string): ContainerAccessiblePort[] => {
    return ports.map((port) => ({
        private: port.private,
        public: port.public,
        protocol: 'tcp',
        browserAccessible: isBrowserAccessible(port),
        status: containerStatus === 'running' ? 'available' : 'unavailable'
    }));
};

const isBrowserAccessible = (port: ContainerPortMapping): boolean => {
    if(BROWSER_ACCESSIBLE_PORTS.has(port.private) || BROWSER_ACCESSIBLE_PORTS.has(port.public ?? 0)){
        return true;
    }
    const label = (port as ContainerPortMapping & { label?: string }).label?.trim().toLowerCase();
    if(!label){
        return false;
    }
    return BROWSER_ACCESSIBLE_LABELS.some((pattern) => pattern.test(label));
};

export const buildContainerRuntimeConfig = (
        input: { image: string; name: string; env?: ContainerEnvironmentVariable[]; ports?: ContainerPortMapping[]; teamId: string; teamClusterId: string; operationId?: string },
        options: { memoryInMegabytes: number; cpus: number; binds: string[]; groupAdd: string[]; cmd?: string[]; user?: string }
    ) => {
    const sanitizedName = input.name.replace(/\s+/g, '-');
    return {
        image: input.image,
        name: `${sanitizedName}-${Date.now()}`,
        operationId: input.operationId,
        env: input.env,
        ports: input.ports,
        labels: {
            'volt.team.id': input.teamId,
            'volt.team-cluster.id': input.teamClusterId
        },
        memoryInMegabytes: options.memoryInMegabytes,
        cpus: options.cpus,
        binds: options.binds,
        groupAdd: options.groupAdd,
        cmd: options.cmd,
        user: options.user
    };
};

export const toRuntimePorts = (ports: ContainerPortMapping[]): ContainerPortMapping[] => {
    return ports.map((port) => ({ private: port.private }));
};

export const resolveInternalIp = (runtimeContainer: RuntimeContainerInfo): string | undefined => {
    const primaryIp = runtimeContainer.NetworkSettings?.IPAddress;
    if(primaryIp){
        return primaryIp;
    }
    const networks = runtimeContainer.NetworkSettings?.Networks;
    if(!networks){
        return undefined;
    }
    for(const endpoint of Object.values(networks)){
        const address = endpoint?.IPAddress;
        if(address){
            return address;
        }
    }
    return undefined;
};

export const requireInternalIp = (runtimeContainer: RuntimeContainerInfo): string => {
    const internalIp = resolveInternalIp(runtimeContainer);
    if(!internalIp){
        throw ApplicationError.conflict('Container::NetworkingUnavailable', 'Container networking is not ready');
    }
    return internalIp;
};

export const requireRelayInternalIp = (internalIp?: string | null): string => {
    if(!internalIp){
        throw ApplicationError.conflict('Container::PortUnavailable', 'Container networking is not ready yet');
    }
    return internalIp;
};

export const requireTeamClusterId = (teamClusterId?: string): string => {
    if(!teamClusterId){
        throw ApplicationError.conflict('TeamCluster::Missing', 'Container is not assigned to a team cluster');
    }
    return teamClusterId;
};

export const resolveNonPlaceholderInternalIp = (runtimeContainer: RuntimeContainerInfo): string | undefined => {
    const primaryIp = runtimeContainer.NetworkSettings?.IPAddress;
    if(primaryIp && primaryIp !== PLACEHOLDER_INTERNAL_IP){
        return primaryIp;
    }
    const networks = runtimeContainer.NetworkSettings?.Networks;
    if(!networks){
        return undefined;
    }
    for(const endpoint of Object.values(networks)){
        const internalIp = endpoint?.IPAddress;
        if(internalIp && internalIp !== PLACEHOLDER_INTERNAL_IP){
            return internalIp;
        }
    }
    return undefined;
};
