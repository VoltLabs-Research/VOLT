import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import ManifestService, { Manifest } from '@/services/plugins/manifest-service';
import { Artifact } from './artifact-processor';

export interface PluginInfo{
    id: string;
    name: string;
    version: string;
    pluginDir: string;
};

export interface ArtifactInfo{
    plugin: PluginInfo;
    data: Artifact;
};

export interface ArgumentInfo{
    pluginId: string;
    pluginName: string;
    id: string;
    definition: any;
}

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

        const result: string[] = [];
        for(const entry of entries){
            if(!entry.isDirectory()) continue;
            const pluginDir = path.join(this.pluginsDir, entry.name);
            const manifestPath = path.join(this.pluginsDir, 'manifest.yml');
            try{
                await fs.access(manifestPath);
                result.push(entry.name);
            }catch{
                // plugin without manifest.yml
            }
        }

        return result;
    }

    private async loadManifest(pluginId: string): Promise<Manifest>{
        const service = new ManifestService(this.pluginsDir, pluginId);
        return await service.get();
    }

    async listArtifacts(pluginId?: string): Promise<ArtifactInfo[]>{
        const result: ArtifactInfo[] = [];
        const pluginIds = pluginId
            ? [pluginId]
            : await this.discoverPluginDirs();
        for(const id of pluginIds){
            try{
                const manifest = await this.loadManifest(id);
                if(!Array.isArray(manifest.artifacts)) continue;
                for(const artifact of manifest.artifacts){
                    result.push({
                        plugin: {
                            id,
                            name: manifest.name,
                            version: manifest.version,
                            pluginDir: path.join(this.pluginsDir, id)
                        },
                        data: artifact
                    })
                }
            }catch(err){
                console.error(`[PluginRegistry] Failed to load artifacts for plugin "${id}":`, err);
            }
        }
        return result;
    }

    async listArgumentsForPlugin(pluginId: string): Promise<ArgumentInfo[]>{
        const manifest = await this.loadManifest(pluginId);
        const argsDef = manifest.entrypoint.args;
        const result: ArgumentInfo[] = [];
        for(const [id, definition] of Object.entries(argsDef)){
            result.push({
                pluginId,
                pluginName: manifest.name,
                id,
                definition
            });
        }

        return result;
    }
};