import type { ContainerCapabilities } from '../api/entities/container-capabilities';

export const supportsRemoteDesktop = (capabilities?: ContainerCapabilities): boolean => {
    return !!capabilities?.vnc;
};
