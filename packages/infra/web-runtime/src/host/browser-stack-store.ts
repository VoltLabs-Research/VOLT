// What a local stack keeps between starts (its provisioning, plugin seed and secrets), as one JSON
// document in the origin's private file system.
import { randomStackSecret, type StackSecrets } from '@volt/local-stack/stack-env';
import type { BootstrapState, BootstrapStore, PluginSeedState, PluginSeedStore } from '@volt/local-stack/state';

interface StoredState {
    bootstrap?: BootstrapState;
    pluginSeed?: PluginSeedState;
    secrets?: StackSecrets;
}

export class BrowserStackStore implements BootstrapStore, PluginSeedStore {
    // Writes are chained so concurrent updates (the plugin seed records each install) never interleave.
    private tail: Promise<unknown> = Promise.resolve();

    constructor(private readonly fileName = 'volt-local-stack.json'){}

    private async file(): Promise<FileSystemFileHandle> {
        const root = await navigator.storage.getDirectory();
        return root.getFileHandle(this.fileName, { create: true });
    }

    private async read(): Promise<StoredState> {
        const text = await (await (await this.file()).getFile()).text();
        return text ? JSON.parse(text) as StoredState : {};
    }

    private update(change: (state: StoredState) => void): Promise<void> {
        const next = this.tail.then(async () => {
            const state = await this.read();
            change(state);
            const writable = await (await this.file()).createWritable();
            await writable.write(JSON.stringify(state));
            await writable.close();
        });
        this.tail = next.catch(() => {});
        return next;
    }

    async getBootstrap(): Promise<BootstrapState | null> {
        return (await this.read()).bootstrap ?? null;
    }

    setBootstrap(bootstrap: BootstrapState): Promise<void> {
        return this.update((state) => { state.bootstrap = bootstrap; });
    }

    clearBootstrap(): Promise<void> {
        return this.update((state) => { delete state.bootstrap; });
    }

    async getPluginSeed(): Promise<PluginSeedState | null> {
        return (await this.read()).pluginSeed ?? null;
    }

    setPluginSeed(pluginSeed: PluginSeedState): Promise<void> {
        return this.update((state) => { state.pluginSeed = pluginSeed; });
    }

    clearPluginSeed(): Promise<void> {
        return this.update((state) => { delete state.pluginSeed; });
    }

    // The stack's secrets, created on its first start: the server's data is encrypted with them.
    async getSecrets(): Promise<StackSecrets> {
        const existing = (await this.read()).secrets;
        if(existing){
            return existing;
        }
        const secrets = { secretKey: randomStackSecret(), sshKey: randomStackSecret() };
        await this.update((state) => { state.secrets ??= secrets; });
        return (await this.read()).secrets ?? secrets;
    }
}
