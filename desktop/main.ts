import { app, BrowserWindow } from 'electron';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);

let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
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

    mainWindow.loadURL('http://192.168.1.85:5173'); 

    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    }); 
};

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if(process.platform !== 'darwin'){
        app.quit();
    }
});