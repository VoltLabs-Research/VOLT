import { Request, Response } from 'express';
import { extractTimesteps, getFileStats, isValidLammpsFile } from '@utilities/lammps';
import { readdir, stat, rmdir, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';

import OpenDXAService from '@services/opendxa';

// TODO: I think these types of validations/processes 
// should be in the bootstrap module, and only happen 
// when the server is started. These directories shouldn't 
// disappear at runtime.
const ensureDirectoriesExist = async () => {
    const directories = [
        process.env.TRAJECTORY_DIR as string,
        process.env.ANALYSIS_DIR as string,
        process.env.UPLOAD_DIR as string
    ];
    
    for(const directory of directories){
        if(!existsSync(directory)){
            await mkdir(directory, { recursive: true });
        }
    }
};

const getSimulationInfo = async (folderPath: string) => {
    try{
        const files = await readdir(folderPath);
        const timestepFiles = [];

        for(const file of files){
            const filePath = join(folderPath, file);
            const fileStat = await stat(filePath);

            if(fileStat.isFile() && /^\d+$/.test(file)){
                timestepFiles.push({
                    name: file,
                    timestep: parseInt(file),
                    size: fileStat.size,
                    modified: fileStat.mtime
                });
            }
        }

        timestepFiles.sort((a, b) => a.timestep - b.timestep);
        const timesteps = timestepFiles.map((file) => file.timestep);

        return {
            folderId: folderPath.split('/').pop(),
            timestepFiles,
            minTimestep: timesteps.length > 0 ? timesteps[0] : -1,
            maxTimestep: timesteps.length > 0 ? timesteps[timesteps.length - 1] : -1,
            totalFiles: timestepFiles.length,
            totalSize: timestepFiles.reduce((sum, file) => sum + file.size, 0),
            files: timestepFiles
        }
    }catch(error){
        console.error(`Error getting simulation info for ${folderPath}:`, error);
        throw error;
    }
};

/**
 * @route DELETE /api/trajectories/{folder_id}
 * @desc Delete a trajectory folder and its contents
*/
export const deleteFolder = async (req: Request, res: Response) => {
    try{
        const { folderId } = req.params;
        const folderPath = join(process.env.TRAJECTORY_DIR as string, folderId);
        const analysisPath = join(process.env.ANALYSIS_DIR as string, folderId);

        if(!existsSync(folderPath)){
            res.status(404).json({
                status: 'error',
                data: { error: `Folder "${folderId}" not found` }
            });
        }

        await rmdir(folderPath, { recursive: true });
        console.log(`Deleted trajectory folder: ${folderPath}`);

        if(existsSync(analysisPath)){
            await rmdir(analysisPath, { recursive: true });
            console.log(`Deleted analysis folder: ${analysisPath}`);
        }

        res.status(200).json({ status: 'success' });
    }catch(error){
        console.error('Error deleting folder:', error);
        res.status(500).json({
            status: 'error',
            data: { error: error instanceof Error ? error.message : 'Unknown error' }
        });
    }
};

/**
 * @route POST /api/trajectories
 * @desc Upload multiple trajectory files
*/
export const uploadTrajectoryFiles = async (req: Request, res: Response) => {
    try{
        await ensureDirectoriesExist();

        const files = req.files as Express.Multer.File[];
        if(!files || files.length === 0){
            return res.status(400).json({
                status: 'error',
                data: { error: 'No files uploaded' }
            });
        }

        const folderId = uuidv4();
        const folderPath = join(process.env.TRAJECTORY_DIR as string, folderId);
        await mkdir(folderPath, { recursive: true });

        const uploadResults = [];
        let validFiles = 0;

        for(const file of files){
            try{
                const content = file.buffer.toString('utf-8');
                const lines = content.split('\n');
                const timesteps = extractTimesteps(lines);
                if(timesteps.length === 0){
                    console.warn(`No timesteps found in file: ${file.originalname}`);
                    uploadResults.push({
                        originalName: file.originalname,
                        status: 'skipped',
                        reason: 'No timesteps found'
                    });
                    continue;
                }

                if(!isValidLammpsFile(lines)){
                    console.warn(`Invalid LAMMPS format: ${file.originalname}`);
                    uploadResults.push({
                        originalName: file.originalname,
                        status: 'skipped',
                        reason: 'Invalid LAMMPS format'
                    });
                    continue;
                }

                // Use first timestep as filename
                // TODO: This should be more robust; if a file has more than 
                // one timestep, they should be created separately. Additionally, 
                // in LAMMPS, all timesteps can be transferred to a single file. 
                // Here, we're assuming the user isn't doing any of these things.
                const timestep = timesteps[0];
                const filename = timestep.toString();
                const filePath = join(folderPath, filename);

                await writeFile(filePath, file.buffer);
                validFiles++;

                const fileStats = getFileStats(lines);
                uploadResults.push({
                    originalName: file.originalname,
                    savedAs: filename,
                    timestep,
                    status: 'success',
                    stats: fileStats
                });

                console.log(`Saved file: ${file.originalname} -> ${filename}`);
            }catch(error){
                console.error(`Error processing file ${file.originalname}:`, error);
                uploadResults.push({
                    originalName: file.originalname,
                    status: 'error',
                    error: error instanceof Error ? error.message : 'Unknown error'
                })
            }
        }

        if(validFiles === 0){
            // Clean up empty folder
            await rmdir(folderPath, { recursive: true });
            return res.status(400).json({
                error: 'No valid trajectory files uploaded',
                details: uploadResults
            });
        }

        const simulationInfo = await getSimulationInfo(folderPath);
        res.status(201).json({
            status: 'success',
            data: {
                folderId,
                uploadedFiles: validFiles,
                totalFiles: files.length,
                simulationInfo,
                uploadResults
            }
        });
    }catch(error){
        console.error('Error uploading files:', error);
        res.status(500).json({
            status: 'error',
            data: { error: error instanceof Error ? error.message : 'Unknown error' }
        });
    }
};

/**
 * @route GET /api/trajectories
 * @desc List all uploaded trajectory folders with metadata
*/
export const listTrajectories = async (req: Request, res: Response) => {
    try{
        await ensureDirectoriesExist();

        const folders = await readdir(process.env.TRAJECTORY_DIR as string);
        const foldersInfo = [];

        for(const folder of folders){
            const folderPath = join(process.env.TRAJECTORY_DIR as string, folder);
            const folderStat = await stat(folderPath);

            if(folderStat.isDirectory()){
                try{
                    const info = await getSimulationInfo(folderPath);
                    foldersInfo.push(info);
                }catch(error){
                    console.error(`Error getting info for folder ${folder}:`, error);
                }
            }
        }

        res.json({
            totalSimulations: foldersInfo.length,
            simulations: foldersInfo
        });
    }catch(error){
        console.error('Error listing simulations:', error);
        res.status(500).json({
            status: 'error',
            data: { error: error instanceof Error ? error.message : 'Unknown error' }
        });
    }
};

/**
 * @route GET /api/trajectories/{folder_id}
 * @desc Get simulation info for a specific trajectory folder
*/
export const getTrajectorySimulationInfo = async (req: Request, res: Response) => {
    try{
        const { folderId } = req.params;
        const folderPath = join(process.env.TRAJECTORY_DIR as string, folderId);
        
        if(!existsSync(folderPath)){
            return res.status(404).json({
                status: 'error',
                data: { error: 'Folder not found' }
            });
        }

        const simulationInfo = await getSimulationInfo(folderPath);
        res.status(200).json({
            status: 'success',
            data: simulationInfo
        });
    }catch(error){
        console.error(`Error getting simulation info for ${req.params.folder_id}:`, error);
        res.status(500).json({
            status: 'error',
            data: { error: error instanceof Error ? error.message : 'Unknown error' }
        });
    }
};

/**
 * @route POST /api/trajectories/{folder_id}/analyze
 * @desc Analyze trajectory using OpenDXA
*/
export const analyzeTrajectory = async (req: Request, res: Response) => {
    try{
        const { folderId } = req.params;
        const folderPath = join(process.env.TRAJECTORY_DIR as string, folderId);
        const analysisPath = join(process.env.ANALYSIS_DIR as string, folderId);

        if(!existsSync(folderPath)){
            return res.status(404).json({
                status: 'error',
                data: { error: 'Trajectory folder not found' }
            });
        }      
        
        if(!existsSync(analysisPath)){
            await mkdir(analysisPath, { recursive: true });
        }

        // Get trajectory files
        const files = await readdir(folderPath);
        const trajectoryFiles = files
            .filter((file) => /^\d+$/.test(file))
            .sort((a, b) => parseInt(a) - parseInt(b))
            .map((file) => join(folderPath, file));

        if(trajectoryFiles.length === 0){
            return res.status(400).json({
                status: 'error',
                data: { error: 'No trajectory files found' }
            });
        }

        const opendxa = new OpenDXAService();
        opendxa.configure(req.body);

        // this is async
        const analysisPromise = opendxa.analyzeTrajectory(
            trajectoryFiles,
            join(analysisPath, 'frame_{}.json')
        );

        res.status(202).json({
            status: 'success',
            data: {
                folderId
            }
        });
    }catch(error){
        console.error(`Error starting analysis for ${req.params.folder_id}:`, error);
        res.status(500).json({
            status: 'error',
            data: { error: error instanceof Error ? error.message : 'Unknown error' }
        });
    }
};