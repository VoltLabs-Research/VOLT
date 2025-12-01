/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
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
 */

import logger from '@/logger';
import { spawn } from 'node:child_process';

export interface CLIResult{
    code: number;
    stderr: string;
};

export default class CLIExec{
    constructor(){}

    run(execPath: string, args: string[]): Promise<CLIResult>{
        return new Promise(async (resolve, reject) => {
            logger.info(`[CLI Exec] ${execPath} ${args.join(' ')}`);
            const child = spawn(execPath, args);

            let stderr = '';
            child.stderr.on('data', (data) => {
                const message = data.toString().trim();
                logger.error(`[CLI Exec] error: ${message}`);
                stderr += message + '\n';
            });

            child.stdout.on('data', (data) => {
                logger.info(`[CLI Exec]: ${data.toString().trim()}`);
            });

            child.on('close', (code) => {
                if(code === 0){
                    resolve({ code: 0, stderr: '' });
                }else{
                    const errorMessage = `Process exited with code ${code}.\nError log:\n${stderr}`;
                    reject(new Error(errorMessage));
                }
            });

            child.on('error', (err) => {
                reject(new Error(`Failed to start process: ${err.message}`));
            });
        });
    }
};