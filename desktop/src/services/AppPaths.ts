import { app } from 'electron';
import path from 'node:path';

export default class AppPaths{
    readonly composeFile: string;
    readonly configFile: string;
    readonly downloadDir: string;

    constructor(){
        const resources = app.isPackaged ? process.resourcesPath : process.cwd();
        const data = app.isPackaged ? app.getPath('userData') : process.cwd();

        this.composeFile = path.join(resources, 'stack', 'compose.yml');
        this.configFile = path.join(data, 'app-config.json');
        this.downloadDir = path.join(data, 'downloads');
    }
};
