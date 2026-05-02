import archiver from 'archiver';
import { PassThrough } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import type { TeamClusterInstallManifestFileDTO } from '@modules/cluster/application/dtos/GenerateTeamClusterInstallManifestDTO';

const DAEMON_BUILD_CONTEXT_PREFIX = 'cluster-daemon/';

export const createTeamClusterDaemonBuildContextArchiveBase64 = async (
    files: TeamClusterInstallManifestFileDTO[]
): Promise<string> => {
    const output = new PassThrough();
    const archive = archiver('tar', {
        gzip: true
    });

    archive.on('error', (error) => output.destroy(error));
    archive.pipe(output);

    for (const file of files) {
        if (!file.path.startsWith(DAEMON_BUILD_CONTEXT_PREFIX)) {
            continue;
        }

        archive.append(`${file.contents}\n`, {
            name: file.path.slice(DAEMON_BUILD_CONTEXT_PREFIX.length),
            mode: parseInt(file.mode, 8)
        });
    }

    await archive.finalize();

    const compressedArchive = await buffer(output);
    return compressedArchive.toString('base64');
};
