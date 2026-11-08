import * as tar from 'tar';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import type { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import { gunzipSync } from 'node:zlib';
import * as path from 'node:path';
import { withDir } from 'tmp-promise';
import type Docker from 'dockerode';
import { buildPath } from '@volt/contracts/shared/routing';
import { clusterLifecycleRoutes } from '@volt/contracts/modules/cluster/routes';
import type { GenerateTeamClusterInstallManifestResponse, TeamClusterInstallManifest } from '@volt/contracts/modules/cluster/domain';
import type { DaemonRuntimeUpdatePayload } from '@volt/contracts/modules/system/domain';
import type { DaemonConfig } from '@core/config/daemon';
import { createDockerClient } from '@shared/runtime/docker-client';

const DOCKER_SOCKET = '/var/run/docker.sock';
const UPDATER_IMAGE = 'docker:27-cli';
const UPDATER_LABEL = 'dev.voltcloud.cluster-updater';

// The install directory install.sh made on the host, which holds this daemon's compose project.
export const resolveInstallDir = (config: DaemonConfig): string | null => {
    if(!config.installRoot || !config.composeProjectName) return null;
    return path.posix.join(config.installRoot, config.teamClusterId);
};

// What install.sh's start_stack does: build the daemon from the sources the server sent when there are
// any, otherwise pull its image, and bring the project up. The volumes, and so the cluster's data, stay.
const composeScript = (installDir: string, projectName: string): string => {
    const compose = `docker compose --project-name '${projectName}' --project-directory '${installDir}' --file '${installDir}/docker-compose.yml'`;
    return [
        'set -eu',
        // Lets this daemon answer the command before compose replaces its container.
        'sleep 2',
        `if [ -d '${installDir}/packages/infra/cluster' ]; then`,
        `  ${compose} up -d --build --remove-orphans`,
        'else',
        `  ${compose} pull`,
        `  ${compose} up -d --remove-orphans`,
        'fi'
    ].join('\n');
};

const fetchManifest = async (config: DaemonConfig, payload: DaemonRuntimeUpdatePayload, installRoot: string): Promise<TeamClusterInstallManifest> => {
    const url = `${config.voltCloudUrl}${buildPath(clusterLifecycleRoutes.generateInstallManifest, { teamClusterId: config.teamClusterId })}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            daemonPassword: config.daemonPassword,
            installRoot,
            ports: payload.ports
        }),
        signal: AbortSignal.timeout(60_000)
    });
    if(!response.ok) throw new Error(`The server answered ${response.status} for this cluster's install manifest`);

    const body = await response.json() as { data?: GenerateTeamClusterInstallManifestResponse };
    if(!body.data?.manifest) throw new Error('The server sent no install manifest');
    return body.data.manifest;
};

// The manifest's files as a tar to copy into the install directory, with the markers install.sh writes.
// Written out first so the tar keeps each file's mode, as install.sh's chmod did.
const manifestFilesTar = (manifest: TeamClusterInstallManifest): Promise<Buffer> =>
    withDir(async ({ path: stagingDir }) => {
        const entries: Array<{ path: string; contents: string; mode: number }> = [
            ...manifest.files.map((file) => ({
                path: file.path,
                contents: `${file.contents}\n`,
                mode: Number.parseInt(file.mode, 8)
            })),
            {
                path: '.compose-project-name',
                contents: `${manifest.composeProjectName}\n`,
                mode: 0o644
            },
            {
                path: '.install-manifest-version',
                contents: `${manifest.manifestVersion}\n`,
                mode: 0o644
            }
        ];

        for(const entry of entries){
            const target = path.join(stagingDir, entry.path);
            if(!target.startsWith(`${stagingDir}${path.sep}`)) throw new Error(`The manifest has a file outside the install directory: ${entry.path}`);
            await mkdir(path.dirname(target), { recursive: true });
            await writeFile(target, entry.contents);
            await chmod(target, entry.mode);
        }

        return buffer(tar.c({
            cwd: stagingDir,
            portable: true
        }, entries.map((entry) => entry.path)) as unknown as Readable);
    }, { unsafeCleanup: true });

const pullImage = async (docker: Docker, image: string): Promise<void> => {
    try{
        await docker.getImage(image).inspect();
        return;
    }catch{
        // Not on this host yet.
    }
    const stream = await docker.pull(image);
    await new Promise<void>((resolve, reject) => {
        docker.modem.followProgress(stream, (error) => error ? reject(error) : resolve());
    });
};

// Moves this daemon's install to the server's release. The daemon cannot replace its own container,
// so a short-lived container on the same host writes the new install and runs compose, the way
// install.sh did. Returns once that container has started.
export const startDaemonSelfUpdate = async (config: DaemonConfig, payload: DaemonRuntimeUpdatePayload): Promise<void> => {
    const installDir = resolveInstallDir(config);
    if(!installDir || !config.installRoot || !config.composeProjectName){
        throw new Error('This cluster was not installed with install.sh, so it updates with the stack it belongs to.');
    }

    const manifest = await fetchManifest(config, payload, config.installRoot);
    const docker = createDockerClient();
    await pullImage(docker, UPDATER_IMAGE);

    const previous = await docker.listContainers({
        all: true,
        filters: { label: [UPDATER_LABEL] }
    });
    for(const container of previous){
        await docker.getContainer(container.Id).remove({ force: true }).catch(() => undefined);
    }

    const container = await docker.createContainer({
        name: `${manifest.composeProjectName}-updater-${Date.now()}`,
        Image: UPDATER_IMAGE,
        Cmd: ['sh', '-c', composeScript(installDir, manifest.composeProjectName)],
        Labels: { [UPDATER_LABEL]: payload.version },
        HostConfig: {
            Binds: [`${DOCKER_SOCKET}:${DOCKER_SOCKET}`, `${installDir}:${installDir}`],
            RestartPolicy: { Name: 'no' }
        }
    });

    // Copied before the container starts, into the install directory mounted from the host.
    if(manifest.buildContextArchiveBase64){
        await container.putArchive(gunzipSync(Buffer.from(manifest.buildContextArchiveBase64, 'base64')), { path: installDir });
    }
    await container.putArchive(await manifestFilesTar(manifest), { path: installDir });

    await container.start();
};
