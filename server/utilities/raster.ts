import { readdir } from 'fs/promises';

export const listRasterModels = async (
    rasterDir: string,
    frame: number,
    analysisId: string
): Promise<string[]> => {
    const allFiles = await readdir(rasterDir);
    const regex = new RegExp(`^frame-${frame}_(.+)_analysis-${analysisId}(?:\\..+)?$`);
    const models = new Set<string>();
    
    for(const file of allFiles){
        const match = file.match(regex);
        if(match){
            const model = match[1];
            if(model === 'interface_mesh') continue;
            models.add(model);
        }
    }

    return Array.from(models);
};