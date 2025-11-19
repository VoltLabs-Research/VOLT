import { slugify } from '@/utilities/runtime';
import { Analysis } from '@/models';
import ManifestService from '@/services/plugins/manifest-service';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const sanitizeModelName = (value: string) => {
    return value
        ? value.toLowerCase().replace(/[^a-z0-9_\-]+/g, '-').replace(/^-+/, '').replace(/-+$/, '') || 'preview'
        : 'preview';
};

export const templateReplace = (template: string, values: Record<string, string | number>) => {
    return template.replace(/\{([^}]+)\}/g, (_match, key) => {
        const k = String(key);
        return values[k] !== undefined ? String(values[k]) : '';
    });
};

export const getValueByPath = (obj: any, path: string): any => {
    if(!path) return obj;
    return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
};

const getPluginsDir = () => {
    return process.env.PLUGINS_DIR || path.resolve(process.cwd(), 'server/plugins');
}

export const resolvePluginOutputDefinition = async (
    analysisId: string,
    artifactKey: string
) => {
    const analysis = await Analysis.findById(analysisId).select('plugin key');
    if(!analysis?.plugin || !analysis?.key){
        return null;
    }

    const pluginsDir = getPluginsDir();
    const resolvedPluginName = resolvePluginFolderName(analysis.plugin);

    const manifestService = new ManifestService(pluginsDir, resolvedPluginName);
    const manifest = await manifestService.get();
    const definition = manifest.analyses?.find((entry) => entry.id === analysis.key);
    if(!definition || !definition.outputs?.length){
        return null;
    }

    const normalizedKey = slugify(artifactKey);
    const output = definition.outputs.find((output: any) => slugify(output.artifact) === normalizedKey);
    if(!output){
        return null;
    }

    return { definition, output, plugin: analysis.plugin };
};

const resolvePluginFolderName = (pluginName: string) => {
    const baseDir = getPluginsDir();
    const directPath = path.join(baseDir, pluginName);
    if(fs.existsSync(directPath)){
        return pluginName;
    }
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    const match = entries.find((entry) => entry.isDirectory() && entry.name.toLowerCase() === pluginName.toLowerCase());
    if(match){
        return match.name;
    }
    throw new Error(`Plugin directory not found for ${pluginName} inside ${baseDir}`);
};