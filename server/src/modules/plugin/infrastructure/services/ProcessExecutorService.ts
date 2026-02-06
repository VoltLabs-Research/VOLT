import { injectable } from 'tsyringe';
import { spawn } from 'node:child_process';
import { IProcessExecutorService, ExecutionResult } from '@modules/plugin/domain/ports/IProcessExecutorService';
import logger from '@shared/infrastructure/logger';
import fs from 'node:fs/promises';

@injectable()
export default class ProcessExecutorService implements IProcessExecutorService{
    async execute(
        commandPath: string,
        args: string[],
        cwd?: string
    ): Promise<ExecutionResult>{
        await this.ensureExecutable(commandPath);
        return await this.spawnProcess(commandPath, args, cwd);
    }

    private async ensureExecutable(path: string): Promise<void>{
        try{
            fs.access(path, fs.constants.X_OK);
        }catch{
            throw new Error(`Binary not accessible or executable: ${path}`);
        }
    }

    private spawnProcess(cmd: string, args: string[], cwd?: string): Promise<ExecutionResult>{
        return new Promise((resolve, reject) => {
            logger.info(`@processor-executor-service: running: ${cmd} ${args.join(' ')}`);

            const child = spawn(cmd, args, { cwd });
            let stderr = '';

            child.stderr.on('data', (data) => {
                const message = data.toString().trim();
                if(message){
                    logger.debug(`@processor-executor-service: stderr: ${message}`);
                    stderr += message + '\n';
                }
            });

            child.stdout.on('data', (data) => {
                logger.debug(`@process-executor-service: stdout: ${data.toString().trim()}`);
            });

            child.on('close', (code) => {
                if(code === 0) resolve({ code: 0, stderr });
                else reject(new Error(`Process exited with code ${code}. Logs:\n${stderr}`));
            });

            child.on('error', (error) => reject(new Error(`Failed to start process: ${error.message}`)));
        }); 
    }
};