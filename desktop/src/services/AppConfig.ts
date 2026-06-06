import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

export interface AppConfigProps{
    configFile: string;
}

export interface BootstrapState{
    done: boolean;
    email: string;
    password: string;
    userId: string;
    teamId: string;
    teamClusterId: string;
    enrollmentToken: string;
    authToken: string;
    // The server mints a random daemon password per cluster (encrypted at rest). The
    // daemon authenticates its control-plane websocket with it, so we reveal it once
    // at bootstrap and feed it back into the daemon's env. Without it the handshake
    // is rejected and the daemon crash-loops on "did not connect before timeout".
    daemonPassword: string;
}

export interface DevModeState{
    enabled: boolean;
    voltPath: string;
    clusterDaemonPath: string;
}

export default class AppConfig{
    constructor(private readonly props: AppConfigProps){}

    async #write(config: object){
        await writeFile(this.props.configFile, JSON.stringify(config, null, 2));
    }

    async get(): Promise<Record<string, any>>{
        if(!existsSync(this.props.configFile)) return {};
        const configStr = await readFile(this.props.configFile);
        return JSON.parse(configStr.toString());
    }

    async update(payload: object){
        const current = await this.get();
        const merged = { ...current, ...payload };

        await this.#write(merged);
    }

    async updateRelease(repoId: string, tag: string){
        await this.update({ [repoId]: { tag } });
    }

    async checkInstalledRelease(repoId: string): Promise<string>{
        const config = await this.get();

        if(!config?.[repoId]){
            return '0';
        }

        return config[repoId].tag;
    }

    async getStackEnv(): Promise<Record<string, string>>{
        const config = await this.get();
        return (config.env ?? {}) as Record<string, string>;
    }

    async ensureStackDefaults(defaults: Record<string, string>){
        const config = await this.get();
        const merged = { ...defaults, ...(config.env ?? {}) };
        await this.update({ env: merged });
    }

    async getBootstrap(): Promise<BootstrapState | null>{
        const config = await this.get();
        const bootstrap = config.bootstrap as Partial<BootstrapState> | undefined;
        if(!bootstrap?.done) return null;
        return bootstrap as BootstrapState;
    }

    async setBootstrap(state: BootstrapState){
        await this.update({ bootstrap: state });
    }

    async clearBootstrap(){
        const current = await this.get();
        delete current.bootstrap;
        await this.#write(current);
    }

    // Returns the dev-mode source override only when it is enabled and both
    // paths are set; null otherwise so callers can treat it as "release mode".
    async getDevMode(): Promise<DevModeState | null>{
        const config = await this.get();
        const dev = config.devMode as Partial<DevModeState> | undefined;
        if(!dev?.enabled || !dev.voltPath || !dev.clusterDaemonPath) return null;
        return dev as DevModeState;
    }

    async setDevMode(state: DevModeState){
        await this.update({ devMode: state });
    }
};
