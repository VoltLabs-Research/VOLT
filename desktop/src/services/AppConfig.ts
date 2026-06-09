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
    authToken: string;
    daemonPassword: string;
}

export interface DevModeState{
    enabled: boolean;
    voltPath: string;
    clusterDaemonPath: string;
}

export interface DeploymentState{
    mode: 'local' | 'remote';
    remote?: {
        serverEndpoint: string;
        clientUrl: string;
    };
}

export interface WindowBounds{
    x?: number;
    y?: number;
    width: number;
    height: number;
    maximized?: boolean;
}

export type ThemePreference = 'system' | 'light' | 'dark';

const MAX_RECENT_ENDPOINTS = 5;

export default class AppConfig{
    constructor(private readonly props: AppConfigProps){}

    async #write(config: object){
        await writeFile(this.props.configFile, JSON.stringify(config, null, 2));
    }

    async get(): Promise<Record<string, any>>{
        if(!existsSync(this.props.configFile)) return {};
        const text = (await readFile(this.props.configFile)).toString().trim();
        if(!text) return {};
        try{ return JSON.parse(text); }catch{ return {}; }
    }

    async #update(payload: object){
        const current = await this.get();
        const merged = { ...current, ...payload };

        await this.#write(merged);
    }

    async updateRelease(repoId: string, tag: string){
        await this.#update({ [repoId]: { tag } });
    }

    async getInstalledReleaseTag(repoId: string): Promise<string | null>{
        const config = await this.get();
        return config?.[repoId]?.tag ?? null;
    }

    async getStackEnv(): Promise<Record<string, string>>{
        const config = await this.get();
        return (config.env ?? {}) as Record<string, string>;
    }

    async setStackEnv(env: Record<string, string>){
        await this.#update({ env });
    }

    async getMode(): Promise<string | undefined>{
        return (await this.get()).deployMode as string | undefined;
    }

    async setMode(mode: string){
        await this.#update({ deployMode: mode });
    }

    async getBootstrap(): Promise<BootstrapState | null>{
        const config = await this.get();
        const bootstrap = config.bootstrap as Partial<BootstrapState> | undefined;
        if(!bootstrap?.done) return null;
        return bootstrap as BootstrapState;
    }

    async setBootstrap(state: BootstrapState){
        await this.#update({ bootstrap: state });
    }

    async clearBootstrap(){
        const current = await this.get();
        delete current.bootstrap;
        await this.#write(current);
    }

    async getActiveDevMode(): Promise<DevModeState | null>{
        const dev = await this.getPersistedDevMode();
        if(!dev?.enabled || !dev.voltPath || !dev.clusterDaemonPath) return null;
        return dev as DevModeState;
    }

    async getPersistedDevMode(): Promise<Partial<DevModeState> | undefined>{
        return (await this.get()).devMode as Partial<DevModeState> | undefined;
    }

    async setDevMode(state: DevModeState){
        await this.#update({ devMode: state });
    }

    async getDeployment(): Promise<DeploymentState | null>{
        const config = await this.get();
        return (config.deployment as DeploymentState | undefined) ?? null;
    }

    async setDeployment(state: DeploymentState){
        await this.#update({ deployment: state });
    }

    async clearDeployment(){
        const current = await this.get();
        delete current.deployment;
        await this.#write(current);
    }

    async getWindowBounds(): Promise<WindowBounds | null>{
        const bounds = (await this.get()).windowBounds as WindowBounds | undefined;
        if(!bounds || typeof bounds.width !== 'number' || typeof bounds.height !== 'number') return null;
        return bounds;
    }

    async setWindowBounds(bounds: WindowBounds){
        await this.#update({ windowBounds: bounds });
    }

    async getTheme(): Promise<ThemePreference>{
        const theme = (await this.get()).theme;
        return theme === 'light' || theme === 'dark' ? theme : 'system';
    }

    async setTheme(theme: ThemePreference){
        await this.#update({ theme });
    }

    async getRecentEndpoints(): Promise<string[]>{
        const list = (await this.get()).recentEndpoints;
        return Array.isArray(list) ? list.filter((item): item is string => typeof item === 'string') : [];
    }

    async addRecentEndpoint(endpoint: string){
        const existing = await this.getRecentEndpoints();
        const next = [endpoint, ...existing.filter((item) => item !== endpoint)].slice(0, MAX_RECENT_ENDPOINTS);
        await this.#update({ recentEndpoints: next });
    }
};
