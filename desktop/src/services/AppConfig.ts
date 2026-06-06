import { readFile, writeFile } from 'node:fs/promises';

export interface AppConfigProps{
    configFile: string;   
}

export default class AppConfig{
    props: AppConfigProps;

    constructor(props: AppConfigProps){
        this.props = props;
    }

    async get(): Promise<Record<string, any>>{
        const configStr = await readFile(this.props.configFile);

        return JSON.parse(configStr.toString());
    }

    async update(payload: object){
        const current = await this.get();
        const merged = { ...current, ...payload };
        
        await writeFile(this.props.configFile, JSON.stringify(merged, null, 2));
    }

    async updateRelease(repoId: string, tag: string){
        await this.update({ [repoId]: { tag } });
    }

    async checkInstalledRelease(repoId: string): Promise<string>{
        const config = await this.get();

        if(!config?.[repoId]){
            return '0';
        }

        return config[repoId].tag;
    }
};