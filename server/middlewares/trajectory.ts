import { Request, Response, NextFunction } from 'express';
import { extractTimestepInfo, isValidLammpsFile } from '@utilities/lammps';
import { mkdir, writeFile, rmdir } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { join } from 'path';
import { ITimestepInfo } from '@types/models/trajectory';
import LAMMPSToGLTFExporter, { GLTFExportOptions } from '@utilities/lammpsGltfExporter';
import Trajectory from '@models/trajectory';

export const processAndValidateUpload = async (req: Request, res: Response, next: NextFunction) => {
    const files = req.files as Express.Multer.File[];
    if(!files || files.length === 0) {
        return res.status(400).json({
            status: 'error',
            data: { error: 'No files uploaded' }
        });
    }

    const gltfOptions: Partial<GLTFExportOptions> = {
        spatialCulling: false,
        subsampleRatio: 1.0,
        maxAtoms: req.body.maxAtoms ? parseInt(req.body.maxAtoms) : 0,
        maxInstancesPerMesh: 10000
    };

    const trajectoryId = uuidv4();
    const folderPath = join(process.env.TRAJECTORY_DIR as string, trajectoryId);
    const gltfFolderPath = join(folderPath, 'gltf');
        
    await mkdir(folderPath, { recursive: true });
    await mkdir(gltfFolderPath, { recursive: true });

    let validFileCounts = 0;
    let totalSize = 0;

    const frames: ITimestepInfo[] = [];
    const gltfExporter = new LAMMPSToGLTFExporter();

    console.log(`Processing ${files.length} files for trajectory ${trajectoryId}...`);

    for(const file of files){
        try{
            const content = file.buffer.toString('utf-8');
            const lines = content.split('\n');
            const frameInfo = extractTimestepInfo(lines);

            if(!frameInfo || !isValidLammpsFile(lines)){
                console.warn(`Skipping invalid file: ${file.originalname}`);
                continue;
            }

            const filename = frameInfo.timestep.toString();
            const lammpsFilePath = join(folderPath, filename);
            const gltfFilePath = join(gltfFolderPath, `${filename}.gltf`);

            await writeFile(lammpsFilePath, file.buffer);

            try{
                console.log(`Generating GLTF for timestep ${frameInfo.timestep}...`);

                gltfExporter.exportAtomsToGLTF(
                    lammpsFilePath, 
                    gltfFilePath, 
                    extractTimestepInfo, 
                    gltfOptions
                );
                console.log(`GLTF generated for timestep ${frameInfo.timestep}`);
            }catch(gltfError){
                console.error(`Error generating GLTF for timestep ${frameInfo.timestep}:`, gltfError);
            }

            frames.push({
                ...frameInfo,
                gltfPath: `gltf/${filename}.gltf`
            });

            validFileCounts++;
            totalSize += file.size;

        }catch(error){
            console.error(`Error processing file ${file.originalname}:`, error);
            continue;
        }
    }

    if(validFileCounts === 0){
        await rmdir(folderPath, { recursive: true });
        return res.status(400).json({
            status: 'error',
            data: { error: 'No valid trajectory files found' }
        });
    }

    console.log(`Successfully processed ${validFileCounts} files with GLTF exports`);

    res.locals.trajectoryData = {
        folderId: trajectoryId,
        name: req.body.name || 'Untitled Trajectory',
        frames: frames.sort((a, b) => a.timestep - b.timestep),
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