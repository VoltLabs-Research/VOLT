import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import ProcessRunner from '@/services/ProcessRunner';

const execAsync = promisify(execFile);

export interface BuildImageProps{
    source: string;
    imageTag: string;
    dockerfile?: string;
}

export interface RunContainerProps{
    name: string;
    imageTag: string;
    cwd?: string;
}

export default class Docker{
    runner: ProcessRunner;
    
    constructor(){
        this.runner = new ProcessRunner();
}
    
    async runContainer(props: RunContainerProps): Promise<string>{
        return this.runner.capture(
            'docker',
            ['container', 'run', '-d', '--name', props.name, props.imageTag],
            props.cwd
        )
    }

    async buildImage(props: BuildImageProps){
        await this.runner.run(
            'docker',
            ['image', 'build', '-t', props.imageTag, '-f', props.dockerfile ?? 'Dockerfile', '.'],
            props.source
        );
    }

    async removeContainerIfExists(name: string): Promise<void>{
        try{
            await execAsync('docker', ['container', 'rm', '-f', name]);
        }catch{
            // ignore if doesn't exists
        }
    }

    async isReady(){
        try{
            await execAsync('docker', ['version']);
        }catch(error: any){
            if(error?.code === 'ENOENT'){
                throw new Error('Docker CLI is not installed');
            }
        }

        try{
            await execAsync('docker', ['system', 'info']);
        }catch(error: any){
            throw new Error('Docker is already installed but daemon is not available');
        }
    }
};