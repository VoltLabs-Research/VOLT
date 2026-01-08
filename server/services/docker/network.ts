import { docker } from '@/services/docker/client';
import { DockerNetwork } from '@/models/index';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';

class NetworkService {
    /**
     * Creates a Docker network and records it in the database.
     */
    async createNetwork(containerName: string) {
        const networkName = `volterra-${containerName.replace(/\s+/g, '-').toLowerCase()}-net`;

        try {
            const network = await docker.createNetwork({
                Name: networkName,
                Driver: 'bridge',
                CheckDuplicate: true
            });
            const info = await network.inspect();

            const networkDoc = await DockerNetwork.create({
                networkId: info.Id,
                name: networkName,
                driver: 'bridge'
            });

            return { network: { id: info.Id, name: info.Name }, networkDoc };
        } catch (error: any) {
            throw new RuntimeError(ErrorCodes.DOCKER_NETWORK_CREATE_ERROR, 500);
        }
    }

    /**
     * Connects a container to a network.
     */
    async connectContainer(containerId: string, networkId: string) {
        try {
            const network = docker.getNetwork(networkId);
            await network.connect({ Container: containerId });
        } catch (error: any) {
            throw new RuntimeError(ErrorCodes.DOCKER_NETWORK_CONNECT_ERROR, 500);
        }
    }

    /**
     * Connects a container using a previously saved network document ID.
     */
    async connectContainerByDocId(containerId: string, networkDocId: string) {
        const networkDoc = await DockerNetwork.findById(networkDocId);
        if (networkDoc?.networkId) {
            await this.connectContainer(containerId, networkDoc.networkId);
        }
    }

    /**
     * Removes a network by its document ID.
     */
    async removeNetworkByDocId(networkDocId: string) {
        const networkDoc = await DockerNetwork.findById(networkDocId);
        if (networkDoc?.networkId) {
            try {
                const network = docker.getNetwork(networkDoc.networkId);
                await network.remove();
            } catch (error: any) {
                if (error.statusCode !== 404) {
                    throw new RuntimeError(ErrorCodes.DOCKER_NETWORK_REMOVE_ERROR, 500);
                }
            }
        }
    }

    /**
     * Gets the internal IP of a container on the specific network.
     */
    getContainerIp(containerInfo: any, containerName: string) {
        const networkName = `volterra-${containerName.replace(/\s+/g, '-').toLowerCase()}-net`;
        return containerInfo.NetworkSettings?.Networks?.[networkName]?.IPAddress || null;
    }
}

export default new NetworkService();
