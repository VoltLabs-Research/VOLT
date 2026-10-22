// The desktop app as scripts/smoke.mjs runs it: the built main process, with its window never shown
// and DevTools' remote debugging on, so the smoke drives the page without putting a window on screen.
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

app.commandLine.appendSwitch('remote-debugging-port', '0');
BrowserWindow.prototype.show = () => {};

void import(pathToFileURL(path.join(__dirname, '..', 'out', 'main', 'main.js')).href);
