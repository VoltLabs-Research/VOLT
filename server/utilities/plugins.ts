import { Analysis } from '@/models';
import ManifestService from '@/services/plugins/manifest-service';
import RuntimeError from '@/utilities/runtime/runtime-error';
import storage from '@/services/storage';
import { SYS_BUCKETS } from '@/config/minio';
import { decode } from '@msgpack/msgpack';

export const getModifierPerAtomProps = async (analysisId: string): Promise<Record<string, string[]>> => {
    const props: Record<string, string[]> = {};

    const analysis = await Analysis.findById(analysisId);
    if(!analysis) throw new RuntimeError('Analysis::NotFound', 404);

    const manifest = await new ManifestService(analysis.plugin).get();
    const modifier = manifest.modifiers?.[analysis.modifier];

    if(!modifier) throw new RuntimeError('Analysis::Modifier::NotFound', 404);
    for(const [key, exposure] of Object.entries(modifier.exposure)){
        if(exposure.perAtomProperties && Array.isArray(exposure.perAtomProperties)){
            props[key] = exposure.perAtomProperties;
        }
    }

    return props;
};

export const getModifierAnalysis = async (
    trajectoryId: string,
    analysisId: string, 
    exposureId: string,
    timestep: string
): Promise<string[]> => {
    const key = `plugins/trajectory-${trajectoryId}/analysis-${analysisId}/${exposureId}/timestep-${timestep}.msgpack`;
    const buffer = await storage.getBuffer(SYS_BUCKETS.PLUGINS, key);
    let data: any = decode(buffer);

    // Check if we need to unwrap an iterable key
    const analysis = await Analysis.findById(analysisId);
    if(analysis){
        const manifest = await new ManifestService(analysis.plugin).get();
        const modifier = manifest.modifiers?.[analysis.modifier];
        const exposure = modifier?.exposure?.[exposureId];

        if(exposure && exposure.iterable && data[exposure.iterable]){
            data = data[exposure.iterable];
        }
    }

    return data;
};

export const getPropertyByAtoms = (data: any, property: string): Float32Array | Map<number, number> | undefined => {
    let values = undefined;

    if(Array.isArray(data)){
        values = new Map<number, number>();
        for(let i = 0; i < data.length; i++){
            const item = data[i];
            let propValue: number;
            
            // Handle array properties (e.g., strain_tensor, deformation_gradient)
            if(Array.isArray(item[property])){
                // Calculate the magnitude/norm of the array
                const arr = item[property] as number[];
                propValue = Math.sqrt(arr.reduce((sum, val) => sum + val * val, 0));
            }else{
                propValue = Number(item[property]);
                // Skip if not a valid number
                if(isNaN(propValue)){
                    continue;
                }
            }
            
            // TODO: item.id is the atom_id, should be a rule 
            // for the development of new plugins
            values.set(item.id, propValue);
        }
    }else if(data[property]){
        values = data[property];
    }

    return values;
};