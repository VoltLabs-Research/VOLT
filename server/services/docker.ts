import Docker from 'dockerode';
import RuntimeError from '@/utilities/runtime-error';

class DockerService {
    private docker: Docker;

    constructor() {
        this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
    }

    async createContainer(config: any) {
        try {
            // Ensure image exists or pull it
            await this.ensureImage(config.Image);

            const container = await this.docker.createContainer(config);
            return container;
        } catch (error: any) {
            throw new RuntimeError(`Docker::Create::${error.message}`, 500);
        }
    }

    async ensureImage(imageName: string) {
        try {
            const image = this.docker.getImage(imageName);
            try {
                await image.inspect();
            } catch (e) {
                console.log(`Pulling image ${imageName}...`);
                await new Promise((resolve, reject) => {
                    this.docker.pull(imageName, (err: any, stream: any) => {
                        if (err) return reject(err);
                        this.docker.modem.followProgress(stream, onFinished, onProgress);

                        function onFinished(err: any, output: any) {
                            if (err) return reject(err);
                            resolve(output);
                        }

                        function onProgress(event: any) {
                            // console.log(event);
                        }
                    });
                });
            }
        } catch (error: any) {
            throw new RuntimeError(`Docker::Pull::${error.message}`, 500);
        }
    }

    async startContainer(containerId: string) {
        try {
            const container = this.docker.getContainer(containerId);
            await container.start();
        } catch (error: any) {
            throw new RuntimeError(`Docker::Start::${error.message}`, 500);
        }
    }

    async stopContainer(containerId: string) {
        try {
            const container = this.docker.getContainer(containerId);
            await container.stop();
        } catch (error: any) {
            // Ignore if already stopped
            if (error.statusCode !== 304) {
                throw new RuntimeError(`Docker::Stop::${error.message}`, 500);
            }
        }
    }

    async removeContainer(containerId: string) {
        try {
            const container = this.docker.getContainer(containerId);
            await container.remove({ force: true });
        } catch (error: any) {
            if (error.statusCode !== 404) {
                throw new RuntimeError(`Docker::Remove::${error.message}`, 500);
            }
        }
    }

    async getContainerStats(containerId: string) {
        try {
            const container = this.docker.getContainer(containerId);
            const stats = await container.stats({ stream: false });
            return stats;
        } catch (error: any) {
            throw new RuntimeError(`Docker::Stats::${error.message}`, 500);
        }
    }

    async inspectContainer(containerId: string) {
        try {
            const container = this.docker.getContainer(containerId);
            const info = await container.inspect();
            return info;
        } catch (error: any) {
            throw new RuntimeError(`Docker::Inspect::${error.message}`, 500);
        }
    }

    getContainer(containerId: string) {
        return this.docker.getContainer(containerId);
    }

    async getContainerProcesses(containerId: string) {
        try {
            const container = this.docker.getContainer(containerId);
            // Request specific columns to match the UI requirements:
            // pid, comm (program), args (command), nlwp (threads), user, rss (mem), pcpu (cpu%)
            const processes = await container.top({ ps_args: '-o pid,comm,args,nlwp,user,rss,pcpu' });
            return processes;
        } catch (error: any) {
            throw new RuntimeError(`Docker::Top::${error.message}`, 500);
        }
    }

    async execCommand(containerId: string, command: string[]) {
        try {
            const container = this.docker.getContainer(containerId);
            const exec = await container.exec({
                Cmd: command,
                AttachStdout: true,
                AttachStderr: true
            });

            const stream = await exec.start({ hijack: true, stdin: false });

            return new Promise<string>((resolve, reject) => {
                let output = '';
                this.docker.modem.demuxStream(stream, {
                    write: (chunk: Buffer) => { output += chunk.toString('utf8'); }
                }, {
                    write: (chunk: Buffer) => { output += chunk.toString('utf8'); }
                });

                stream.on('end', () => resolve(output));
                stream.on('error', reject);
            });
        } catch (error: any) {
            throw new RuntimeError(`Docker::Exec::${error.message}`, 500);
        }
    }
}

export const dockerService = new DockerService();
