import type { ContainerAccessiblePort } from '@/modules/container/api/entities/container-accessible-port';

export const getPrimaryAccessiblePort = (
    accessiblePorts?: ContainerAccessiblePort[]
): ContainerAccessiblePort | null => {
    if (!accessiblePorts?.length) {
        return null;
    }

    return accessiblePorts.find((port) => port.browserAccessible && port.status === 'available' && typeof port.public === 'number') || null;
};
