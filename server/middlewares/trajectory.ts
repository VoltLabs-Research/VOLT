/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

import { Request, Response, NextFunction } from 'express';
import { extractTimestepInfo, isValidLammpsFile } from '@utilities/lammps';
import { mkdir, writeFile, rmdir } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { join } from 'path';
import { ITimestepInfo } from '@types/models/trajectory';
import LAMMPSToGLTFExporter, { GLTFExportOptions } from '@utilities/export/atoms';
import Trajectory from '@models/trajectory';
import Team from '@models/team';

interface ProcessingResult {
    success: boolean;
    frameInfo?: ITimestepInfo;
    fileSize: number;
    error?: string;
}

async function processFileParallel(
    file: Express.Multer.File, 
    folderPath: string, 
    gltfFolderPath: string, 
    gltfOptions: Partial<GLTFExportOptions>
): Promise<ProcessingResult> {
    try {
        const [content, frameInfo, isValid] = await Promise.all([
            Promise.resolve(file.buffer.toString('utf-8')),
            Promise.resolve(extractTimestepInfo(file.buffer.toString('utf-8').split('\n'))),
            Promise.resolve(isValidLammpsFile(file.buffer.toString('utf-8').split('\n')))
        ]);

        if(!frameInfo || !isValid){
            return {
                success: false,
                fileSize: file.size,
                error: `Invalid LAMMPS file: ${file.originalname}`
            };
        }

        const filename = frameInfo.timestep.toString();
        const lammpsFilePath = join(folderPath, filename);
        const gltfFilePath = join(gltfFolderPath, `${filename}.gltf`);

        await Promise.all([
            writeFile(lammpsFilePath, file.buffer),
            Promise.resolve()
        ]);

        const gltfExporter = new LAMMPSToGLTFExporter();
        await Promise.resolve(gltfExporter.exportAtomsToGLTF(
            lammpsFilePath, 
            gltfFilePath, 
            extractTimestepInfo, 
            gltfOptions
        ));

        return {
            success: true,
            frameInfo: {
                ...frameInfo,
                gltfPath: `gltf/${filename}.gltf`
            },
            fileSize: file.size
        };

    } catch (error) {
        return {
            success: false,
            fileSize: file.size,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

async function processFilesInBatches(
    files: Express.Multer.File[], 
    batchSize: number, 
    folderPath: string, 
    gltfFolderPath: string, 
    gltfOptions: Partial<GLTFExportOptions>
): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];
    
    for(let i = 0; i < files.length; i += batchSize){
        const batch = files.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(files.length/batchSize)} (${batch.length} files)`);
        
        const batchPromises = batch.map(file => processFileParallel(file, folderPath, gltfFolderPath, gltfOptions));
        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach((result, index) => {
            if(result.status === 'fulfilled'){
                results.push(result.value);
            }else{
                console.error(`Error processing file ${batch[index].originalname}:`, result.reason);
                results.push({
                    success: false,
                    fileSize: batch[index].size,
                    error: result.reason?.message || 'Unknown error'
                });
            }
        });
    }
    
    return results;
}

export const processAndValidateUpload = async (req: Request, res: Response, next: NextFunction) => {
    const files = req.files as Express.Multer.File[];
    if(!files || files.length === 0) {
        return res.status(400).json({
            status: 'error',
            data: { error: 'No files uploaded' }
        });
    }

    const { teamId, name } = req.body;
    if(!teamId){
        return res.status(400).json({
            status: 'error',
            data: { error: 'A teamId is required to create a trajectory' }
        });
    }

    const gltfOptions: Partial<GLTFExportOptions> = {
        subsampleRatio: 1.0,
        maxAtoms: req.body.maxAtoms ? parseInt(req.body.maxAtoms) : 0,
        maxInstancesPerMesh: 10000
    };

    const trajectoryId = uuidv4();
    const folderPath = join(process.env.TRAJECTORY_DIR as string, trajectoryId);
    const gltfFolderPath = join(folderPath, 'gltf');
        
    await mkdir(folderPath, { recursive: true });
    await mkdir(gltfFolderPath, { recursive: true });

    console.log(`Processing ${files.length} files for trajectory ${trajectoryId}...`);

    const BATCH_SIZE = Math.min(8, Math.max(2, Math.floor(files.length / 4)));
    const results = await processFilesInBatches(files, BATCH_SIZE, folderPath, gltfFolderPath, gltfOptions);

    const validFrames = results.filter(result => result.success);
    
    if(validFrames.length === 0){
        await rmdir(folderPath, { recursive: true });
        return res.status(400).json({
            status: 'error',
            data: { error: 'No valid trajectory files found' }
        });
    }

    const totalSize = validFrames.reduce((sum, frame) => sum + frame.fileSize, 0);
    console.log(`Successfully processed ${validFrames.length} files with GLTF exports`);

    res.locals.trajectoryData = {
        folderId: trajectoryId,
        name: name || 'Untitled Trajectory',
        team: teamId,
        frames: validFrames
            .map(frame => frame.frameInfo)
            .sort((a, b) => a.timestep - b.timestep),
        stats: {
            totalFiles: validFrames.length,
            totalSize: totalSize
        }
    };

    next();
};

export const checkTeamMembershipForTrajectory = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = (req as any).user.id;
    const trajectory = await Trajectory.findById(id);

    if(!trajectory){
        return res.status(404).json({
            status: 'error',
            data: { error: 'Trajectory not found' }
        });
    }

    const team = await Team.findOne({ _id: trajectory.team, members: userId });
    if(!team){
        return res.status(403).json({
            status: 'error',
            data: { error: 'Forbidden. Your do not have access to this trajectory.' }
        });
    }

    res.locals.trajectory = trajectory;
    res.locals.team = team;

    next();
};