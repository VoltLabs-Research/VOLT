import { app } from 'electron';
import path from 'node:path';

export interface AppPaths{
    configFile: string;
    runtimeDir: string;
    stackDataDir: string;
    logsDir: string;
}

export const resolveAppPaths = (): AppPaths => {
    const resources = app.isPackaged ? process.resourcesPath : process.cwd();
    const data = app.isPackaged ? app.getPath('userData') : process.cwd();
    const stackDataDir = path.join(data, 'local-stack');

    return {
        configFile: path.join(data, 'app-config.json'),
        runtimeDir: app.isPackaged ? path.join(resources, 'stack') : path.join(process.cwd(), 'stack-runtime'),
        stackDataDir,
        logsDir: path.join(stackDataDir, 'logs')
    };
};
