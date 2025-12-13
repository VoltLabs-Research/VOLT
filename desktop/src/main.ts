import { app, BrowserWindow } from 'electron';
import DockerManager from './docker-manager.js'

let mainWindow: BrowserWindow | null = null;
let dockerManager: DockerManager | null = null;

const createWindow = async() => {
    dockerManager = new DockerManager();

    console.log('[Volterra] Starting Docker services...');
    const dockerStarted = await dockerManager.start();

    if(!dockerStarted){
        console.error('[Volterra] Failed to start Docker services');
        app.quit();
        return;
    }

    const servicesReady = await dockerManager.waitForServices();

    if(!servicesReady){
        console.error('[Volterra] Services did not start properly');
        app.quit();
        return;
    }

    console.log('[Volterra] Waiting for client container...');

    const viteUrl = 'http://localhost:5173';
    const maxRetries = 30;
    let viteReady = false;

    for(let i = 0; i < maxRetries; i++){
        try{
            const response = await fetch(viteUrl);
            if(response.ok){
                viteReady = true;
                console.log('[Volterra] Vite dev server is ready');
                break;
            }
        }catch(error){
            // Server not ready yet, wait and retry
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if(!viteReady){
        console.error('[Volterra] Vite dev server failed to start');
        app.quit();
        return;
    }

    // Create main window
    mainWindow = new BrowserWindow({
        width: 1700,
        height: 940,
        title: 'Volterra',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    mainWindow.setMenu(null);
    mainWindow.webContents.openDevTools();

    mainWindow.loadURL('http://localhost:5173');

    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
};

app.whenReady().then(createWindow);

app.on('window-all-closed', async() => {
    // Stop Docker services(including client container)
    if(dockerManager){
        console.log('[OpenDXA] Stopping Docker services...');
        await dockerManager.stop();
        dockerManager = null;
    }

    if(process.platform !== 'darwin'){
        app.quit();
    }
});

app.on('before-quit', async(event) => {
    if(dockerManager && await dockerManager.getIsRunning()){
        event.preventDefault();
        await dockerManager.stop();
        app.quit();
    }
});
