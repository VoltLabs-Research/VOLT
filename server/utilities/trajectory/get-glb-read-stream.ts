import TrajectoryVFS from '@/services/trajectory-vfs';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';

const getFrameGlbReadStream = async (trajectoryId: string, timestep?: string) => {
    const vfs = new TrajectoryVFS(trajectoryId);

    const getAnyGlb = async () => {
        try {
            const files = await vfs.list(`trajectory-${trajectoryId}/previews`);
            const glbFile = files.find((f: any) => f.name.endsWith('.glb'));

            if (!glbFile) {
                throw new RuntimeError(ErrorCodes.TRAJECTORY_VFS_FILE_NOT_FOUND, 404);
            }

            return await vfs.getReadStream(glbFile.relPath);
        } catch (error) {
            throw new RuntimeError(ErrorCodes.TRAJECTORY_VFS_FILE_NOT_FOUND, 404);
        }
    };

    if (!timestep || timestep === 'undefined' || timestep === 'null') {
        return await getAnyGlb();
    }

    const path = `trajectory-${trajectoryId}/previews/timestep-${timestep}.glb`;

    try {
        return await vfs.getReadStream(path);
    } catch (error: any) {
        if (error instanceof RuntimeError && error.code === ErrorCodes.TRAJECTORY_VFS_FILE_NOT_FOUND) {
            return await getAnyGlb();
        }
        throw error;
    }
};

export default getFrameGlbReadStream;