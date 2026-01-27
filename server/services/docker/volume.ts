import { docker } from '@/services/docker/client';
import { DockerVolume } from '@/models/index';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';

class VolumeService {
    /**
     * Creates or retrieves the volume name for a container.
     */
    getVolumeName(containerName: string) {
        return `Volt-${containerName.replace(/\s+/g, '-').toLowerCase()}-data`;
    }

    /**
     * Creates a named volume and records it in the database.
     */
    async createVolume(containerName: string) {
        const volumeName = this.getVolumeName(containerName);

        try {
            const volume = await docker.createVolume({
                Name: volumeName,
                Driver: 'local'
            });

            const volumeDoc = await DockerVolume.create({
                volumeId: volume.Name || volumeName,
                name: volumeName,
                driver: 'local'
            });

            return { volume: { id: volume.Name || volumeName, name: volume.Name || volumeName }, volumeDoc };
        } catch (error: any) {
            throw new RuntimeError(ErrorCodes.DOCKER_VOLUME_CREATE_ERROR, 500);
        }
    }

    /**
     * Removes a volume by name.
     */
    async removeVolume(volumeName: string): Promise<void> {
        try {
            const volume = docker.getVolume(volumeName);
            await volume.remove();
        } catch (error: any) {
            if (error.statusCode !== 404) {
                throw new RuntimeError(ErrorCodes.DOCKER_VOLUME_REMOVE_ERROR, 500);
            }
        }
    }

    /**
     *  Generates the bind configuration for mounting data volume.
     */
    getDataBind(containerName: string) {
        const volumeName = this.getVolumeName(containerName);
        return `${volumeName}:/data`;
    }
}

export default new VolumeService();
