import { app } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface AppPaths{
    configFile: string;
    // The web client's build (packages/apps/client/dist), which the window loads.
    clientDir: string;
}

export const resolveAppPaths = (): AppPaths => ({
    configFile: path.join(app.getPath('userData'), 'app-config.json'),
    // Outside a package, the build next to this one in the workspace (this module is out/main/main.js).
    clientDir: app.isPackaged
        ? path.join(process.resourcesPath, 'client')
        : fileURLToPath(new URL('../../../client/dist', import.meta.url))
});
