import Docker from '@/services/Docker';
import path from 'path';
import Stack from '@/services/Stack';
import bus from '@/services/EventBus';

export interface DeployProps{
    composeFile: string;
    envFile: string;
    voltSourceDir: string;
    clusterSourceDir: string;
};
    
export default class Deploy{
    props: DeployProps
    docker: Docker

    constructor(props: DeployProps){
        this.props = props;
        this.docker = new Docker();
    }

    async start(){
        bus.emit('deploy:state', { state: 'starting' });
        try{
            await this.#stack().up();
            bus.emit('deploy:state', { state: 'up' });
        }catch(err: any){
            bus.emit('deploy:state',  { state: 'error', message: err.message });
            throw err;
        }
    }

    async stop(){
        bus.emit('deploy:state', { state: 'stopping' });
        try{
            await this.#stack().down();
            bus.emit('deploy:state', { state: 'down' });
        }catch(err: any){
            bus.emit('deploy:state', { state: 'error', message: err.message });
            throw err;
        }
    }

    #stack(){
        return new Stack({
            composeFile: this.props.composeFile,
            env: {
                VOLT_SOURCE_DIR: path.resolve(this.props.voltSourceDir),
                CLUSTER_DAEMON_SOURCE_DIR: path.resolve(this.props.clusterSourceDir)
            }
        });
    }
};