import path from 'path';

export const getGLBPath = async (timestep: string, type: string, analysisId: string, folderId: string): Promise<null | string> => {
    const basePath = path.resolve(process.cwd(), process.env.TRAJECTORY_DIR as string);
    const fileName = type
        ? `frame-${timestep}_${type}_analysis-${analysisId}.glb`
        : `${timestep}.glb`;
    
    const glbFilePath = path.join(basePath, folderId.toString(), 'glb', fileName);

    return glbFilePath;
};