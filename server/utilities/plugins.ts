import { Analysis, Plugin } from '@/models';
import { NodeType } from '@/types/models/plugin';
import { SYS_BUCKETS } from '@/config/minio';
import { decode } from '@msgpack/msgpack';
import storage from '@/services/storage';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';
import { findAncestorByType } from './plugins/workflow-utils';
import { getMinMaxNative, computeMagnitudesNative } from '@/parsers/lammps/native-stats';

export const getModifierPerAtomProps = async(analysisId: string): Promise<Record<string, string[]>> =>{
    const props: Record<string, string[]> = {};
    const analysis = await Analysis.findById(analysisId);
    if(!analysis) throw new RuntimeError(ErrorCodes.ANALYSIS_NOT_FOUND, 404);

    const plugin = await Plugin.findOne({ slug: analysis.plugin });
    if(!plugin) throw new RuntimeError(ErrorCodes.PLUGIN_NOT_FOUND, 404);

    const visualizerNodes = plugin.workflow.nodes.filter((node) => node.type === NodeType.VISUALIZERS);
    for(const visualizerNode of visualizerNodes){
        const visualizersData = visualizerNode.data?.visualizers;
        if(visualizersData && visualizersData.perAtomProperties?.length){
            const exposureNode = findAncestorByType(visualizerNode.id, plugin.workflow, NodeType.EXPOSURE);
            props[exposureNode?.id] = visualizersData.perAtomProperties;
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
    if(data[property] instanceof Float32Array){
        return data[property];
    }

    if(data[property] && Array.isArray(data[property])) {
        return new Float32Array(data[property]);
    }

    // Array of objects with id/property structure
    if(Array.isArray(data) && data.length > 0) {
        const len = data.length;
        const firstItem = data[0];
        const isVector = Array.isArray(firstItem?.[property]);

        // Find max ID for sparse array allocation
        let maxId = 0;
        for(let i = 0; i < len; i++){
            const id = data[i].id;
            if(id > maxId) maxId = id;
        }

        const values = new Float32Array(maxId + 1);

        if(isVector){
            // Extract vectors for C++ magnitude calculation
            const vectors: any[] = new Array(len);
            const ids: number[] = new Array(len);
            for(let i = 0; i < len; i++){
                vectors[i] = data[i][property];
                ids[i] = data[i].id;
            }

            // Use C++ for magnitude calculation
            const magnitudes = computeMagnitudesNative(vectors);
            if(magnitudes){
                for(let i = 0; i < len; i++){
                    values[ids[i]] = magnitudes[i];
                }
                return values;
            }

        }else{
            // Scalar values, direct extraction
            for(let i = 0; i < len; i++){
                values[data[i].id] = Number(data[i][property]) || 0;
            }
        }

        return values;
    }

    return undefined;
};

export const getMinMaxFromData = (data: any, property: string): { min: number, max: number } | undefined => {
    // 1. Direct Float32Array/Float64Array - use native C++ for maximum performance
    if(data && (data[property] instanceof Float32Array || data[property] instanceof Float64Array)) {
        const result = getMinMaxNative(data[property]);
        if(result) return result;
    }

    // 2. Regular Array on object property - convert to Float32Array and use native
    if(data && Array.isArray(data[property])) {
        const arr = new Float32Array(data[property]);
        const result = getMinMaxNative(arr);
        if(result) return result;
    }

    // 3. Array of objects(e.g. [{id: 1, c_energy: -2.5}, ...])
    if(Array.isArray(data)) {
        if(data.length === 0) return { min: 0, max: 0 };

        const firstItem = data[0];
        const isVector = Array.isArray(firstItem[property]);
        const len = data.length;

        // For scalar properties, extract values to Float32Array for native processing
        if(!isVector){
            const values = new Float32Array(len);
            for(let i = 0; i < len; i++){
                values[i] = Number(data[i][property]) || 0;
            }
            const result = getMinMaxNative(values);
            if(result) return result;
        }

        // For vector properties, compute magnitude then use native
        const magnitudes = new Float32Array(len);
        for(let i = 0; i < len; i++){
            const arr = data[i][property] as number[];
            if(!arr) continue;
            let sum = 0;
            for(let k = 0; k < arr.length; k++){
                sum += arr[k] * arr[k];
            }
            magnitudes[i] = Math.sqrt(sum);
        }
        const result = getMinMaxNative(magnitudes);
        if(result) return result;
    }

    return undefined;
};
