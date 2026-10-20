import Docker from 'dockerode';

const DOCKER_CLIENT_TIMEOUT_MS = 60_000;

export const createDockerClient = (): Docker => {
    const dockerHost = process.env.DOCKER_HOST;

    if(dockerHost?.startsWith('tcp://')){
        const url = new URL(dockerHost);
        return new Docker({
            host: url.hostname,
            port: Number(url.port || 2375),
            timeout: DOCKER_CLIENT_TIMEOUT_MS
        });
    }

    return new Docker({ timeout: DOCKER_CLIENT_TIMEOUT_MS });
};

let probeClient: Docker | null = null;

export const probeContainerRuntime = async (): Promise<boolean> => {
    probeClient ??= createDockerClient();

    try{
        await probeClient.ping();
        return true;
    }catch{
        return false;
    }
};
