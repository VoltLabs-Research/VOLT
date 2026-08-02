import type { ContainerAccessiblePort } from '@volt/contracts/modules/container/domain';

export const isBrowserAccessiblePort = (port: ContainerAccessiblePort | undefined): boolean => {
    return Boolean(port?.browserAccessible && port.status === 'available' && port.public !== undefined);
};

export const getPrimaryAccessiblePort = (
    accessiblePorts?: ContainerAccessiblePort[]
): ContainerAccessiblePort | null => {
    return accessiblePorts?.find(isBrowserAccessiblePort) ?? null;
};
