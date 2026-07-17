import type { ContainerAccessiblePort } from '@/modules/container/api/types/container-accessible-port';

export const getPrimaryAccessiblePort = (
    accessiblePorts?: ContainerAccessiblePort[]
): ContainerAccessiblePort | null => {
    if (!accessiblePorts?.length) {
        return null;
    }

    return accessiblePorts.find((port) => port.browserAccessible && port.status === 'available' && typeof port.public === 'number') || null;
};
