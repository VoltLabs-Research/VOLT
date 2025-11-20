import { slugify } from '@/utilities/runtime';

export const getArtifactId = (pluginName: string, artifact: string) => {
    return `opendxa-plugins-${pluginName}-${slugify(artifact)}`;
}