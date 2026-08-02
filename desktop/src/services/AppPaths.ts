import { app } from 'electron';
import path from 'node:path';

export const resolveAppPaths = () => {
    const resources = app.isPackaged ? process.resourcesPath : process.cwd();
    const data = app.isPackaged ? app.getPath('userData') : process.cwd();

    return {
        composeFile: path.join(resources, 'stack', 'compose.yml'),
        configFile: path.join(data, 'app-config.json'),
        downloadDir: path.join(data, 'downloads')
    };
};
