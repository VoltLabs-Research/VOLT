import Docker from 'dockerode';
import { existsSync } from 'node:fs';
import path from 'node:path';
import User from '@modules/auth/models/User';
import clusterUpdateService from '@modules/cluster/services/updates/ClusterUpdateService';
import releaseCheckService from '@modules/system/services/ReleaseCheckService';
import { getServerVersion } from '@modules/system/services/server-version';
import ApplicationError from '@shared/errors/ApplicationError';
import { ErrorCodes } from '@core/constants/error-codes';
import logger from '@shared/logger';
import { isNewerVersion } from '@volt/contracts/modules/system/releases';
import type { SystemUpdateStatus } from '@volt/contracts/modules/system/domain';

const DOCKER_SOCKET = '/var/run/docker.sock';
const UPDATER_IMAGE = 'docker:27-cli';
const UPDATER_LABEL = 'dev.voltcloud.updater';
const RELEASE_DOWNLOADS = 'https://github.com/voltlabs-research/volt/releases/download';

// What deploy.sh --update does, run from a container of its own on the server's host: fetch the
// release's deployer and compose file, then let the deployer rebuild the stack. It runs apart from
// the stack because the update takes the server down with everything else.
const UPDATER_SCRIPT = [
    'set -eu',
    'apk add --no-cache nodejs curl >/dev/null',
    'dir="$(dirname "$VOLT_COMPOSE_FILE")"',
    'fetch(){ curl -fsSL --retry 5 --retry-all-errors --retry-delay 2 "$RELEASE_URL/$1" -o "$dir/$1.next" && mv "$dir/$1.next" "$dir/$1"; }',
    'fetch cli.cjs',
    'fetch compose.yml',
    'node "$dir/cli.cjs" --update < /dev/null'
].join('\n');

interface HostDeployment{
    dataDir: string;
    composeFile: string;
}

interface UpdateRun{
    version: string;
    containerName: string;
}

const describe = (error: unknown): string => error instanceof Error ? error.message : String(error);

// Where deploy.sh keeps this deployment on the host. Only a stack deployed with it can update itself.
const hostDeployment = (): HostDeployment | null => {
    const dataDir = process.env.VOLT_DEPLOY_DATA?.trim();
    const composeFile = process.env.VOLT_COMPOSE_FILE?.trim();
    if(!dataDir || !composeFile || !path.isAbsolute(dataDir) || !path.isAbsolute(composeFile)) return null;
    if(!existsSync(DOCKER_SOCKET)) return null;
    return {
        dataDir,
        composeFile
    };
};

class SystemUpdateService{
    #docker = new Docker({ socketPath: DOCKER_SOCKET });
    #run: UpdateRun | null = null;
    #error: string | null = null;

    // The deployment's owner is its first account: deploy.sh creates it before anyone else can sign up.
    async #isServerOwner(userId: string): Promise<boolean>{
        const [first] = await User.find({
            select: { id: true },
            order: { createdAt: 'ASC' },
            take: 1
        });
        return first?.id === userId;
    }

    async status(userId: string): Promise<SystemUpdateStatus>{
        const currentVersion = getServerVersion();
        const latest = currentVersion ? await releaseCheckService.latest() : null;
        const updateAvailable = Boolean(currentVersion && latest && isNewerVersion(latest.version, currentVersion));
        const isOwner = await this.#isServerOwner(userId);

        // An update that finished (this server already runs it) is no longer in progress.
        if(this.#run && currentVersion && !isNewerVersion(this.#run.version, currentVersion)) this.#run = null;

        return {
            currentVersion,
            latest,
            updateAvailable,
            canApply: updateAvailable && isOwner && hostDeployment() !== null,
            applying: this.#run !== null || await this.#updaterRunning(),
            error: isOwner ? this.#error : null,
            clustersBehind: isOwner ? await clusterUpdateService.countBehind() : 0
        };
    }

    async apply(userId: string): Promise<SystemUpdateStatus>{
        if(!await this.#isServerOwner(userId)){
            throw ApplicationError.forbidden(ErrorCodes.SYSTEM_UPDATE_FORBIDDEN, 'Only the account that deployed this server can update it.');
        }

        const host = hostDeployment();
        if(!host){
            throw ApplicationError.conflict(ErrorCodes.SYSTEM_UPDATE_UNAVAILABLE, 'This server was not deployed with deploy.sh, so it cannot update itself. Update it the way it was deployed.');
        }

        const status = await this.status(userId);
        if(status.applying) return status;
        if(!status.updateAvailable || !status.latest){
            throw ApplicationError.conflict(ErrorCodes.SYSTEM_UPDATE_UNAVAILABLE, 'This server already runs the latest release.');
        }

        const version = status.latest.version;
        this.#error = null;
        try{
            this.#run = {
                version,
                containerName: await this.#startUpdater(host, version)
            };
        }catch(error){
            this.#run = null;
            this.#error = `The update could not start: ${describe(error)}`;
            logger.error(`[updates] ${this.#error}`);
            throw ApplicationError.internalServerError(this.#error);
        }

        logger.info(`[updates] updating this server from ${status.currentVersion} to ${version} (container ${this.#run.containerName})`);
        return this.status(userId);
    }

    async #updaterRunning(): Promise<boolean>{
        if(!hostDeployment()) return false;
        try{
            const running = await this.#docker.listContainers({ filters: { label: [UPDATER_LABEL] } });
            return running.length > 0;
        }catch{
            return false;
        }
    }

    async #pullUpdaterImage(): Promise<void>{
        try{
            await this.#docker.getImage(UPDATER_IMAGE).inspect();
            return;
        }catch{
            // Not here yet.
        }

        const stream = await this.#docker.pull(UPDATER_IMAGE);
        await new Promise<void>((resolve, reject) => {
            this.#docker.modem.followProgress(stream, (error) => error ? reject(error) : resolve());
        });
    }

    // Earlier updaters stay behind when they stop, so their logs can be read; one is enough.
    async #removeFinishedUpdaters(): Promise<void>{
        const previous = await this.#docker.listContainers({
            all: true, filters: {
                label: [UPDATER_LABEL],
                status: ['exited', 'dead', 'created']
            }
        });
        for(const container of previous){
            await this.#docker.getContainer(container.Id).remove({ force: true }).catch(() => undefined);
        }
    }

    async #startUpdater(host: HostDeployment, version: string): Promise<string>{
        await this.#pullUpdaterImage();
        await this.#removeFinishedUpdaters();

        const composeDir = path.dirname(host.composeFile);
        // The deployer works with host paths (the compose file, the release sources it builds from),
        // so its directories are mounted at the same paths inside the updater.
        const binds = [...new Set([host.dataDir, composeDir])].map((dir) => `${dir}:${dir}`);
        const containerName = `volt-updater-${Date.now()}`;

        const container = await this.#docker.createContainer({
            name: containerName,
            Image: UPDATER_IMAGE,
            Cmd: ['sh', '-c', UPDATER_SCRIPT],
            Env: [
                `VOLT_DEPLOY_DATA=${host.dataDir}`,
                `VOLT_COMPOSE_FILE=${host.composeFile}`,
                `RELEASE_URL=${RELEASE_DOWNLOADS}/v${version}`,
                ...(process.env.GITHUB_TOKEN ? [`GITHUB_TOKEN=${process.env.GITHUB_TOKEN}`] : [])
            ],
            Labels: { [UPDATER_LABEL]: version },
            HostConfig: {
                // The deployer waits for the stack on localhost, as it does on the host.
                NetworkMode: 'host',
                Binds: [`${DOCKER_SOCKET}:${DOCKER_SOCKET}`, ...binds],
                RestartPolicy: { Name: 'no' }
            }
        });
        await container.start();

        // This server is usually gone before the updater ends. When it is not, a failed update says so.
        void container.wait().then(({ StatusCode }: { StatusCode: number }) => {
            if(StatusCode === 0) return;
            this.#run = null;
            this.#error = `The update to ${version} stopped before it finished. Run "docker logs ${containerName}" on the server to see why, or run deploy.sh --update there.`;
            logger.error(`[updates] ${this.#error}`);
        }).catch(() => undefined);

        return containerName;
    }
}

export default new SystemUpdateService();
