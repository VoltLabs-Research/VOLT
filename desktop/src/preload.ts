import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type { AppEvents } from '@/types/events';

// Seed the client's auth token (local deploy) before its scripts run, and clear it for
// remote so a stale local session never leaks across deployments. Runs on every document
// load — harmless for the shell, which never reads this key.
try{
    const session = ipcRenderer.sendSync('app:clientSession') as { token?: string | null; endpoint?: string | null } | undefined;
    if(session?.endpoint){
        // Pin the client to the local proxy so it never shows the "connect server" screen.
        window.localStorage.setItem('volt:backend:endpoint', session.endpoint);
    }
    // Local deploy hands us a bootstrap token; remote keeps whatever session the client
    // already persisted (a stale token simply 401s once and the client re-prompts sign-in).
    if(session?.token){
        window.localStorage.setItem('authToken', session.token);
    }
}catch{ /* handler not registered yet (first shell load) */ }

contextBridge.exposeInMainWorld('volt', {
    platform: process.platform,
    deploy: {
        start: () => ipcRenderer.invoke('deploy:start'),
        stop: () => ipcRenderer.invoke('deploy:stop'),
        reset: () => ipcRenderer.invoke('deploy:reset')
    },
    docker: {
        preflight: () => ipcRenderer.invoke('docker:preflight')
    },
    config: {
        get: () => ipcRenderer.invoke('config:get')
    },
    shell: {
        openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url)
    },
    devmode: {
        apply: (payload: object) => ipcRenderer.invoke('devmode:apply', payload)
    },
    dialog: {
        pickDirectory: () => ipcRenderer.invoke('dialog:pickDirectory')
    },
    app: {
        voltUrl: () => ipcRenderer.invoke('app:voltUrl'),
        openClient: () => ipcRenderer.invoke('app:openClient'),
        openShell: () => ipcRenderer.invoke('app:openShell')
    },
    remote: {
        probe: (endpoint: string) => ipcRenderer.invoke('remote:probe', endpoint),
        connect: (endpoint: string) => ipcRenderer.invoke('remote:connect', endpoint)
    },
    deployment: {
        get: () => ipcRenderer.invoke('deployment:get'),
        setLocal: () => ipcRenderer.invoke('deployment:setLocal'),
        reset: () => ipcRenderer.invoke('deployment:reset')
    },
    window: {
        minimize: () => ipcRenderer.invoke('window:minimize'),
        maximize: () => ipcRenderer.invoke('window:maximize'),
        close: () => ipcRenderer.invoke('window:close')
    },
    on: (channel: keyof AppEvents, cb: (p: any) => void) => {
        const handler = (_: IpcRendererEvent, payload: any) => cb(payload);
        ipcRenderer.on(channel, handler);
        return () => ipcRenderer.removeListener(channel, handler);
    }
});
