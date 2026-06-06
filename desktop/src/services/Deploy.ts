import Docker from '@/services/Docker';
import path from 'path';

export interface App{
    name: string;
    source: string;
};

export interface DeployProps{
    app: App;
};
    
export default class Deploy{
    props: DeployProps
    docker: Docker

    constructor(props: DeployProps){
        this.props = props;
        this.docker = new Docker();
    }

    async start(){
        const source = path.resolve(this.props.app.source);
        const imageTag = `${this.props.app.name}:latest`;

        await this.docker.buildImage({ source, imageTag });
        await this.docker.removeContainerIfExists(this.props.app.name);

        return this.docker.runContainer({
            name: this.props.app.name,
            imageTag,
            cwd: source
        });
    }
};