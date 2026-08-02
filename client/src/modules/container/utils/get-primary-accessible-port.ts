import type { ContainerAccessiblePort } from '@volt/contracts/modules/container/domain';

export const getPrimaryAccessiblePort = (
    accessiblePorts?: ContainerAccessiblePort[]
): ContainerAccessiblePort | null => {
    if (!accessiblePorts?.length) {
        return null;
    }

    return accessiblePorts.find((port) => port.browserAccessible && port.status === 'available' && port.public !== undefined) || null;
};
