import { readFile, writeFile, chmod } from 'node:fs/promises';
import { existsSync } from 'node:fs';

interface AppConfigProps{
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

    clusterDaemonPath?: string;
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

export type DeployMode = 'server' | 'cluster';

const MAX_RECENT_ENDPOINTS = 5;

export default class AppConfig{
    constructor(private readonly props: AppConfigProps){}

    async #write(config: object){
        await writeFile(this.props.configFile, JSON.stringify(config, null, 2), { mode: 0o600 });
        await chmod(this.props.configFile, 0o600).catch(() => {});
    }

    async get(): Promise<Record<string, unknown>>{
        if(!existsSync(this.props.configFile)) return {};
        const text = (await readFile(this.props.configFile)).toString().trim();
        if(!text) return {};
        try{ return JSON.parse(text) as Record<string, unknown>; }catch{ return {}; }
    }

    async #field<T>(key: string): Promise<T | undefined>{
        return (await this.get())[key] as T | undefined;
    }

    async #update(payload: object){
        const current = await this.get();
        const merged = {
            ...current,
            ...payload
        };

        await this.#write(merged);
    }

    async updateRelease(repoId: string, tag: string){
        await this.#update({ [repoId]: { tag } });
    }

    async getInstalledReleaseTag(repoId: string): Promise<string | null>{
        const release = await this.#field<{ tag?: string }>(repoId);
        return release?.tag ?? null;
    }

    async getStackEnv(): Promise<Record<string, string>>{
        return await this.#field<Record<string, string>>('env') ?? {};
    }

    async setStackEnv(env: Record<string, string>){
        await this.#update({ env });
    }

    async getMode(): Promise<DeployMode | undefined>{
        return this.#field<DeployMode>('deployMode');
    }

    async setMode(mode: DeployMode){
        await this.#update({ deployMode: mode });
    }

    async getBootstrap(): Promise<BootstrapState | null>{
        const bootstrap = await this.#field<Partial<BootstrapState>>('bootstrap');
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
        if(!dev?.enabled || !dev.voltPath) return null;
        return dev as DevModeState;
    }

    async getPersistedDevMode(): Promise<Partial<DevModeState> | undefined>{
        return this.#field<Partial<DevModeState>>('devMode');
    }

    async setDevMode(state: DevModeState){
        await this.#update({ devMode: state });
    }

    async getDeployment(): Promise<DeploymentState | null>{
        return await this.#field<DeploymentState>('deployment') ?? null;
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
        const bounds = await this.#field<WindowBounds>('windowBounds');
        if(!bounds || typeof bounds.width !== 'number' || typeof bounds.height !== 'number') return null;
        return bounds;
    }

    async setWindowBounds(bounds: WindowBounds){
        await this.#update({ windowBounds: bounds });
    }

    async setTheme(theme: ThemePreference){
        await this.#update({ theme });
    }

    async getRecentEndpoints(): Promise<string[]>{
        const list = await this.#field<unknown[]>('recentEndpoints');
        return Array.isArray(list) ? list.filter((item): item is string => typeof item === 'string') : [];
    }

    async addRecentEndpoint(endpoint: string){
        const existing = await this.getRecentEndpoints();
        const next = [endpoint, ...existing.filter((item) => item !== endpoint)].slice(0, MAX_RECENT_ENDPOINTS);
        await this.#update({ recentEndpoints: next });
    }
};
