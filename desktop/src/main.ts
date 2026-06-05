import { app, BrowserWindow } from 'electron';
import { spawn } from 'child_process';
import path from 'path';

const createWindow = () => {
    const win = new BrowserWindow({
        width: 1400,
        height: 900
    });

    // win.loadURL('http://localhost:3000');
};

app.whenReady().then(() => {

    createWindow();
});