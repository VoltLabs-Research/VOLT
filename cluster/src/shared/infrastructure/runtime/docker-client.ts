import Docker from 'dockerode';

const DOCKER_CLIENT_TIMEOUT_MS = 60_000;

/**
 * Connects to the container runtime.
 *
 * `DOCKER_HOST` over TCP is parsed here because dockerode wants host and port as
 * separate fields. Every other shape — a unix socket, a Windows named pipe, an
 * unset variable — is left to docker-modem, which already reads `DOCKER_HOST`,
 * `DOCKER_TLS_VERIFY` and `DOCKER_CERT_PATH` and falls back to the platform's
 * default socket. Naming `/var/run/docker.sock` here instead would report "no
 * container runtime" on a Mac running Docker Desktop, whose socket is under the
 * user's home directory, and on Windows, where it is a named pipe.
 */
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

/** Kept across calls so a probe on every heartbeat does not rebuild the agent. */
let probeClient: Docker | null = null;

/**
 * Whether this host has a container runtime the daemon can reach right now.
 *
 * A ping rather than a check for the socket file: a socket that exists but whose
 * daemon is stopped, or one this process may not read, is indistinguishable from
 * absent as far as the features that need it are concerned. Any failure is a
 * `false`, never a throw — the caller is a heartbeat, and a host without Docker is
 * an ordinary state, not an error.
 */
export const probeContainerRuntime = async (): Promise<boolean> => {
    probeClient ??= createDockerClient();

    try{
        await probeClient.ping();
        return true;
    }catch{
        return false;
    }
};
