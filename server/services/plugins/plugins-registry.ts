import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import ManifestService from '@/services/plugins/manifest-service';
import { Manifest } from '@/plugins/primitives/types/core';

type PluginsManifest = Record<string, Manifest>;

export default class PluginRegistry{
    constructor(
        private pluginsDir = process.env.PLUGINS_DIR || ''
    ){
        if(!this.pluginsDir){
            throw new Error('PLUGINS_DIR is not defined for PluginRegistry.');
        }
    }

    private async discoverPluginDirs(): Promise<string[]>{
        const entries = await fs.readdir(this.pluginsDir, {
            withFileTypes: true
        });

        const plugins: string[] = [];
        for(const entry of entries){
            if(!entry.isDirectory()) continue;
            const pluginDir = path.join(this.pluginsDir, entry.name);
            const manifestPath = path.join(pluginDir, 'manifest.yml');
            await fs.access(manifestPath);
            plugins.push(entry.name);
        }

        return plugins;
    }

    public async getPluginModifiers(pluginId: string){
        const manifest = await this.getManifests();
        const pluginManifest = manifest[pluginId] ?? [];
        return Object.keys(pluginManifest.modifiers);
    }

    public async modifierExists(pluginId: string, modifierId: string){
        const modifiers = this.getPluginModifiers(pluginId);
        return modifiers.hasOwnProperty(modifierId);
    }

    public async exists(pluginId: string){
        const manifests = await this.getManifests();
        return manifests.hasOwnProperty(pluginId);
    }

    public async getManifests(): Promise<PluginsManifest>{
        const plugins = await this.discoverPluginDirs();
        const manifests: Record<string, Manifest> = {};
        const promises = plugins.map(async (plugin) => {
            const service = new ManifestService(this.pluginsDir, plugin);
            manifests[plugin] = await service.get();
        });
        await Promise.all(promises);
        return manifests;
    };
};