import { injectable } from 'tsyringe';
import { spawn } from 'node:child_process';
import { IProcessExecutorService, ExecutionResult } from '@modules/plugin/domain/port/IProcessExecutorService';
import { ErrorCodes, type ErrorCode } from '@core/constants/error-codes';
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
            await fs.access(path, fs.constants.X_OK);
        }catch{
            throw this.createProcessError(ErrorCodes.PLUGIN_EXECUTOR_BINARY_NOT_ACCESSIBLE);
        }
    }

    private createProcessError(code: ErrorCode): Error{
        const error = new Error(code);
        Object.assign(error, {
            code
        });
        return error;
    }

    private spawnProcess(cmd: string, args: string[], cwd?: string): Promise<ExecutionResult>{
        return new Promise((resolve, reject) => {
            logger.info(`@processor-executor-service: running: ${cmd} ${args.join(' ')}`);

            const child = spawn(cmd, args, { cwd });
            let stdout = '';
            let stderr = '';

            child.stderr.on('data', (data) => {
                const message = data.toString().trim();
                if(message){
                    logger.debug(`@processor-executor-service: stderr: ${message}`);
                    stderr += message + '\n';
                }
            });

            child.stdout.on('data', (data) => {
                const message = data.toString().trim();
                if(message){
                    logger.debug(`@process-executor-service: stdout: ${message}`);
                    stdout += message + '\n';
                }
            });

            child.on('close', (code) => {
                if(code === 0) resolve({ code: 0, stdout, stderr });
                else reject(this.createProcessError(ErrorCodes.PLUGIN_EXECUTOR_EXIT_FAILED));
            });

            child.on('error', () => reject(this.createProcessError(ErrorCodes.PLUGIN_EXECUTOR_START_FAILED)));
        }); 
    }
};
