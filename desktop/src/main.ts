import { app, BrowserWindow } from 'electron';
import { registerIpc } from '@/ipc';
import path from 'path';
import AppConfig from '@/services/AppConfig';
import Repository from '@/services/Repository';
import SoftwareUpdater from '@/services/SoftwareUpdater';
import Deploy from '@/services/Deploy';

const appConfig = new AppConfig({
    configFile: './app-config.json'
});

const REPOS = [{
    repo: new Repository({
        owner: 'voltlabs-research',
        repo: 'volt'
    }),
    envKey: 'voltSourceDir'
}, {
    repo: new Repository({
        owner: 'voltlabs-research',
        repo: 'clusterdaemon'
    }),
    envKey: 'clusterDaemonSourceDir'
}];

const ensureSources = async () => {
    const sources: Record<string, string> = {};
    for(const { repo, envKey } of REPOS){
        const repoId = repo.getId();
        const latest = await repo.fetchLatestRelease();
        const installed = await appConfig.checkInstalledRelease(repoId);
        const updater = new SoftwareUpdater({
            repoId,
            downloadDir: './downloads'
        });

        if(latest.tag !== installed){
            sources[envKey] = await updater.update(latest);
            await appConfig.updateRelease(repoId, latest.tag);
        }else{
            sources[envKey] = await updater.resolveExtractedPath();
        }
    }

    return sources;
};

const createWindow = () => {
    const win = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });

    win.loadFile('renderer/index.html');
    return win;
};

app.whenReady().then(() => {
    const sources = ensureSources();

    const deploy = new Deploy({
        composeFile: './stack/compose.yml',
        appConfig,
        voltSourceDir: sources.voltSourceDir,
        clusterSourceDir: sources.clusterSourceDir
    });
    
    const win = createWindow();

    registerIpc(win, { deploy, appConfig });
});

app.on('window-all-closed', () => {
    if(process.platform !== 'darwin'){
        app.quit();
    }
});