import { Analysis, Plugin } from '@/models';
import { NodeType } from '@/types/models/plugin';
import { SYS_BUCKETS } from '@/config/minio';
import { decode } from '@msgpack/msgpack';
import storage from '@/services/storage';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';

export const getModifierPerAtomProps = async(analysisId: string): Promise<Record<string, string[]>> =>{
    const props: Record<string, string[]> = {};
    const analysis = await Analysis.findById(analysisId);
    if(!analysis) throw new RuntimeError(ErrorCodes.ANALYSIS_NOT_FOUND, 404);

    const plugin = await Plugin.findOne({ slug: analysis.plugin });
    if(!plugin) throw new RuntimeError(ErrorCodes.PLUGIN_NOT_FOUND, 404);

    const exposureNodes = plugin.workflow.nodes.filter((node) => node.type === NodeType.EXPOSURE);
    for(const exposureNode of exposureNodes){
        const exposureData = exposureNode.data?.exposure;
        if(exposureData){
            props[exposureNode.id] = exposureData.perAtomProperties || [];
        }
    }
    return props;
};

export const getModifierAnalysis = async(
    trajectoryId: string,
    analysisId: string,
    exposureId: string,
    timestep: string
): Promise<string[]> =>{
    const key = `plugins/trajectory-${trajectoryId}/analysis-${analysisId}/${exposureId}/timestep-${timestep}.msgpack`;
    const buffer = await storage.getBuffer(SYS_BUCKETS.PLUGINS, key);
    let data: any = decode(buffer);

    // check if we need to unwrap an iterable key
    const analysis = await Analysis.findById(analysisId);
    if(analysis){
        const plugin = await Plugin.findOne({ slug: analysis.plugin });
        if(plugin){
            const exposureNode = plugin.workflow.nodes.find((node: any) => node.type === NodeType.EXPOSURE && node.id === exposureId);
            const iterableKey = exposureNode?.data?.exposure?.iterable;
            if(iterableKey && data[iterableKey]){
                data = data[iterableKey];
            }
        }
    }
    return data;
};

export const getPropertyByAtoms = (data: any, property: string): Float32Array | undefined => {
    if(data[property] && (data[property] instanceof Float32Array || Array.isArray(data[property]))) {
        return data[property] instanceof Float32Array
            ? data[property]
            : new Float32Array(data[property]);
    }

    if(Array.isArray(data)) {
        let maxId = 0;
        const len = data.length;
        for(let i = 0; i < len; i++){
            const id = data[i].id;
            if(id > maxId) maxId = id;
        }

        const values = new Float32Array(maxId + 1);
        const firstItem = data[0];
        const isVector = Array.isArray(firstItem?.[property]);

        for(let i = 0; i < len; i++){
            const item = data[i];
            const id = item.id;
            if(isVector){
                // calculate Eucliean magnitude
                const arr = item[property] as number[];
                let sum = 0;
                for(let k = 0; k < arr.length; k++){
                    sum += arr[k] * arr[k];
                }
                values[id] = Math.sqrt(sum);
            }else{
                values[id] = Number(item[property]);
            }
        }
        return values;
    }

    return undefined;
};
