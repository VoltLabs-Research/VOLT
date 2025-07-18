import { Request, Response, NextFunction } from 'express';
import { extractTimesteps, isValidLammpsFile } from '@utilities/lammps';
import { mkdir, writeFile, rmdir } from 'fs/promises';
import Trajectory from '@models/trajectory';
import { v4 as uuidv4 } from 'uuid';
import { join } from 'path';

export const processAndValidateUpload = async (req: Request, res: Response, next: NextFunction) => {
    const files = req.files as Express.Multer.File[];
    if(!files || files.length === 0) {
        return res.status(400).json({
            status: 'error',
            data: { error: 'No files uploaded' }
        });
    }

    const trajectoryId = uuidv4();
    const folderPath = join(process.env.TRAJECTORY_DIR as string, trajectoryId);
    await mkdir(folderPath, { recursive: true });

    let validFileCounts = 0;
    let totalSize = 0;

    for(const file of files){
        const content = file.buffer.toString('utf-8');
        const lines = content.split('\n');

        if(extractTimesteps(lines).length === 0 || !isValidLammpsFile(lines)){
            continue;
        }

        const timestep = extractTimesteps(lines)[0];
        const filename = timestep.toString();
        await writeFile(join(folderPath, filename), file.buffer);

        validFileCounts++;
        totalSize += file.size;
    }

    if(validFileCounts === 0){
        await rmdir(folderPath, { recursive: true });
        return res.status(400).json({
            status: 'error',
            data: { error: 'No valid trajectory files found' }
        });
    }

    res.locals.trajectoryData = {
        folderId: trajectoryId,
        name: req.body.name || 'Untitled Trajectory',
        stats: {
            totalFiles: validFileCounts,
            totalSize: totalSize
        },
        owner: (req as any).user.id
    };

    next();
};

export const checkTrajectoryOwnership = async (req: Request, res: Response, next: NextFunction) => {
    const { trajectoryId } = req.params;
    const userId = (req as any).user.id;
    const trajectory = await Trajectory.findById(trajectoryId);

    if(!trajectory){
        return res.status(404).json({
            status: 'error',
            data: { error: 'Trajectory not found' }
        });
    }

    if(trajectory.owner.toString() !== userId){
        return res.status(403).json({
            status: 'error',
            data: { error: 'Forbidden: You are not the owner of this trajectory' }
        });
    }

    res.locals.trajectory = trajectory;

    next();
};