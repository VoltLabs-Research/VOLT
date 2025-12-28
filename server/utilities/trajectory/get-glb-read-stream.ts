import TrajectoryVFS from '@/services/trajectory-vfs';

const getFrameGlbReadStream = async (trajectoryId: string, timestep: string) => {
    const vfs = new TrajectoryVFS(trajectoryId);
    const path = `trajectory-${trajectoryId}/previews/timestep-${timestep}.glb`;
    
    return await vfs.getReadStream(path);
};

export default getFrameGlbReadStream;