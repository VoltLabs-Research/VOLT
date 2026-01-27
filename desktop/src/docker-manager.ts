/**
 * Copyright(c) 2025, Volt Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
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

import { spawn } from 'child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';
import Docker from 'dockerode';

export default class DockerManager{
    private readonly docker: Docker;
    private readonly projectRoot: string;
    private readonly composePath: string;
    private readonly projectName: string;
    private readonly containerNames = [
        'opendxa-mongodb',
        'opendxa-minio',
        'opendxa-redis',
        'opendxa-client',
        'opendxa-server'
    ];

    private readonly CHECK_INTERVAL_MS = 1000;
    private readonly MAX_RETRIES = 120;

    constructor(){
        this.docker = new Docker();
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        this.projectRoot = join(__dirname, '..', '..');
        this.composePath = join(this.projectRoot, 'docker-compose.yml');
        this.projectName = 'Volt-desktop';
    }

    async checkDocker(): Promise<boolean>{
        try{
            await this.docker.ping();
            return true;
        }catch(error){
            console.error('[DockerManager] Docker daemon not reachable:', error);
            return false;
        }
    }

    async checkComposeFile(): Promise<boolean>{
        try{
            await fs.access(this.composePath);
            return true;
        }catch{
            return false;
        }
    }

    async start(): Promise<boolean>{
        const isAlreadyRunning = await this.getIsRunning();
        if(isAlreadyRunning){
            console.log('[DockerManager] Services are already running according to Docker Engine.');
            return true;
        }

        if(!(await this.checkComposeFile())){
            console.error('[DockerManager] docker-compose.yml not found at:', this.composePath);
            return false;
        }

        if(!(await this.checkDocker())){
            console.error('[DockerManager] Docker Engine is not available.');
            return false;
        }

        await this.cleanupOldContainers();

        return new Promise((resolve) => {
            console.log('[DockerManager] Starting services via Compose...');

            const composeProcess = spawn(
                'docker',
                ['compose', '-p', this.projectName, 'up', '-d', '--remove-orphans'],
                { cwd: this.projectRoot, shell: true }
            );

            composeProcess.stdout?.on('data', (d) => console.log(`[Compose] ${d.toString().trim()}`));
            composeProcess.stderr?.on('data', (d) => console.error(`[Compose Status] ${d.toString().trim()}`));

            composeProcess.on('close', async(code) => {
                if(code === 0){
                    console.log('[DockerManager] Compose command executed. Waiting for health checks...');
                    const healthy = await this.waitForServices();
                    resolve(healthy);
                }else{
                    console.error(`[DockerManager] Failed to start services(exit code: ${code})`);
                    resolve(false);
                }
            });
        });
    }

    async stop(): Promise<void>{
        console.log('[DockerManager] Stopping services...');

        return new Promise((resolve, reject) => {
            const stopProcess = spawn(
                'docker',
                ['compose', '-p', this.projectName, 'down'],
                { cwd: this.projectRoot, shell: true }
            );

            stopProcess.on('close', (code) => {
                if(code === 0){
                    console.log('[DockerManager] Services stopped successfully.');
                    resolve();
                }else{
                    reject(new Error(`Docker compose down failed with code ${code}`));
                }
            });
        });
    }

    async waitForServices(): Promise<boolean>{
        let retries = 0;
        while(retries < this.MAX_RETRIES){
            const isHealthy = await this.checkServicesHealth();
            if(isHealthy){
                console.log('[DockerManager] All services are healthy and ready.');
                return true;
            }
            await new Promise((r) => setTimeout(r, this.CHECK_INTERVAL_MS));
            retries++;
            if(retries % 5 === 0){
                console.log('[DockerManager] Still waiting for services...');
            }
        }

        console.error('[DockerManager] Timeout waiting for services to become healthy.');
        return false;
    }

    private async checkServicesHealth(): Promise<boolean>{
        try{
            const containers = await this.docker.listContainers({
                all: true,
                filters: {
                    label: [`com.docker.compose.project=${this.projectName}`]
                }
            });

            if(containers.length === 0) return false;

            return containers.every(({ State, Status }: any) => {
                if(State !== 'running') return false;
                if(Status.includes('(health: starting)')) return false;
                if(Status.includes('(unhealthy)')) return false;
                return true;
            });
        }catch(error){
            console.error('[DockerManager] Error inspecting containers via API:', error);
            return false;
        }
    }

    private async cleanupOldContainers(): Promise<void>{
        console.log('[DockerManager] Checking for conflicting containers...');
        for(const name of this.containerNames){
            try{
                const container = this.docker.getContainer(name);
                await container.inspect();
                console.log(`[DockerManager] Removing conflicting container: ${name}`);
                await container.remove({ force: true });
            }catch(error: any){
                if(error.statusCode !== 404){
                    console.warn(`[DockerManager] Warning checking container ${name}:`, error);
                }
            }
        }
    }

    async getIsRunning(): Promise<boolean>{
        try{
            const containers = await this.docker.listContainers({
                filters: {
                    label: [`com.docker.compose.project=${this.projectName}`],
                    status: ['running']
                }
            });
            return containers.length > 0;
        }catch{
            return false;
        }
    }
};
