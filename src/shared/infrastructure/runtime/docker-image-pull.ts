import { errorMessage } from '@shared/application/utilities/error-message';
import { OrchestrationAction } from '@shared/contracts/types/http-runtime';
import { ProgressStageType } from '@voltstack/daemon-cluster-client';
import { logger } from '@shared/infrastructure/logger';
import type { RuntimeEventBroker } from '@shared/application/events/RuntimeEventBroker';
import type Docker from 'dockerode';

interface DockerImagePullProgressEvent {
    status: string;
    id?: string;
    progress?: string;
}

const openImagePullStream = (docker: Docker, imageName: string): Promise<NodeJS.ReadableStream> => (
    new Promise<NodeJS.ReadableStream>((resolve, reject) => {
        docker.pull(imageName, (error: Error | null, output?: NodeJS.ReadableStream) => {
            if (error) {
                reject(error);
                return;
            }

            if (!output) {
                reject(new Error(`Docker pull returned no stream for ${imageName}`));
                return;
            }

            resolve(output);
        });
    })
);

const drainImagePullStream = (
    docker: Docker,
    imageName: string,
    stream: NodeJS.ReadableStream
): Promise<void> => {
    let lastStatus = '';

    return new Promise<void>((resolve, reject) => {
        docker.modem.followProgress(stream, (error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        }, (event: DockerImagePullProgressEvent) => {
            const status = event.status;
            if (!status || status === lastStatus) {
                return;
            }

            lastStatus = status;
            logger.info(`Docker image pull progress for imageName=${imageName}: status=${status}, id=${event.id ?? 'none'}, progress=${event.progress ?? 'none'}`);
        });
    });
};

export const ensureDockerImage = async (
    docker: Docker,
    eventBroker: RuntimeEventBroker,
    imageName: string
): Promise<void> => {
    const startedAt = Date.now();

    try {
        await docker.getImage(imageName).inspect();
        return;
    } catch (error) {
        logger.info(`Docker image not available locally; provisioning required for imageName=${imageName}, durationMs=${Date.now() - startedAt}, error=${errorMessage(error)}`);
    }

    const pullStartedAt = Date.now();
    logger.info(`Provisioning Docker image from registry for imageName=${imageName}`);

    eventBroker.emitProgress({
        action: OrchestrationAction.ContainerCreate,
        stage: ProgressStageType.Running,
        timestamp: new Date().toISOString(),
        payload: {
            image: imageName,
            step: 'pulling-image'
        }
    });

    try {
        const stream = await openImagePullStream(docker, imageName);
        await drainImagePullStream(docker, imageName, stream);
        logger.info(`Docker image pull completed for imageName=${imageName}, durationMs=${Date.now() - pullStartedAt}`);
    } catch (error) {
        logger.error(`Docker image pull failed for imageName=${imageName}, durationMs=${Date.now() - pullStartedAt}: ${errorMessage(error)}`);
        throw error;
    }
};
