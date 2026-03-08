import { SYS_BUCKETS } from '@core/config/minio';

import type { IStorageService } from '@shared/domain/port/IStorageService';

export type AnalysisFileType = 'data' | 'chart' | 'model';

export interface AnalysisFileRef {
    bucket: string;
    objectName: string;
    type: AnalysisFileType;
    timestep: number;
};

export interface ExposurePayloadObject {
    objectName: string;
    timestep: number;
};

interface PrefixCollectionConfig {
    bucket: string;
    prefix: string;
    type: AnalysisFileType;
    timestepRegex: RegExp;
    extensionFilter?: string;
};

interface CollectionOptions {
    ignoreErrors?: boolean;
};

const sortByTimestepAndName = (left: AnalysisFileRef, right: AnalysisFileRef): number => {
    if (left.timestep !== right.timestep) {
        return left.timestep - right.timestep;
    }

    return left.objectName.localeCompare(right.objectName);
};

const collectFilesByPrefix = async (
    storageService: IStorageService,
    config: PrefixCollectionConfig,
    options: CollectionOptions = {}
): Promise<AnalysisFileRef[]> => {
    const files: AnalysisFileRef[] = [];

    try {
        for await (const objectName of storageService.listByPrefix(config.bucket, config.prefix, true)) {
            if (config.extensionFilter && !objectName.endsWith(config.extensionFilter)) {
                continue;
            }

            const match = objectName.match(config.timestepRegex);
            if (!match) {
                continue;
            }

            files.push({
                bucket: config.bucket,
                objectName,
                type: config.type,
                timestep: Number(match[1])
            });
        }
    } catch (error: unknown) {
        if (!options.ignoreErrors) {
            throw error;
        }
    }

    return files;
};

export const buildExposurePayloadObjectName = (
    trajectoryId: string,
    analysisId: string,
    exposureId: string,
    timestep: number
): string => {
    return `plugins/trajectory-${trajectoryId}/analysis-${analysisId}/${exposureId}/timestep-${timestep}.msgpack`;
};

export const listExposurePayloadObjects = async (
    storageService: IStorageService,
    trajectoryId: string,
    analysisId: string,
    exposureId: string
): Promise<ExposurePayloadObject[]> => {
    const files = await collectFilesByPrefix(
        storageService,
        {
            bucket: SYS_BUCKETS.PLUGINS,
            prefix: `plugins/trajectory-${trajectoryId}/analysis-${analysisId}/${exposureId}/`,
            type: 'data',
            timestepRegex: /timestep-(\d+)\.msgpack$/,
            extensionFilter: '.msgpack'
        }
    );

    return files
        .sort(sortByTimestepAndName)
        .map(({ objectName, timestep }) => ({
            objectName,
            timestep
        }));
};

export const listAnalysisFiles = async (
    storageService: IStorageService,
    trajectoryId: string,
    analysisId: string,
    options: CollectionOptions = {}
): Promise<AnalysisFileRef[]> => {
    const prefixes: PrefixCollectionConfig[] = [
        {
            bucket: SYS_BUCKETS.PLUGINS,
            prefix: `plugins/trajectory-${trajectoryId}/analysis-${analysisId}/`,
            type: 'data',
            timestepRegex: /\/timestep-(\d+)\.msgpack$/
        },
        {
            bucket: SYS_BUCKETS.PLUGINS,
            prefix: `trajectory-${trajectoryId}/analysis-${analysisId}/charts/`,
            type: 'chart',
            timestepRegex: /\/charts\/(\d+)\//,
            extensionFilter: '.png'
        },
        {
            bucket: SYS_BUCKETS.MODELS,
            prefix: `trajectory-${trajectoryId}/analysis-${analysisId}/glb/`,
            type: 'model',
            timestepRegex: /\/glb\/(\d+)\//,
            extensionFilter: '.glb'
        }
    ];

    const groups = await Promise.all(
        prefixes.map((prefix) => collectFilesByPrefix(storageService, prefix, options))
    );

    return groups.flat().sort(sortByTimestepAndName);
};

export const groupAnalysisFilesByTimestep = (
    files: AnalysisFileRef[]
): Map<number, AnalysisFileRef[]> => {
    const groupedFiles = new Map<number, AnalysisFileRef[]>();

    for (const file of files) {
        const group = groupedFiles.get(file.timestep) || [];
        group.push(file);
        groupedFiles.set(file.timestep, group);
    }

    for (const [timestep, group] of groupedFiles.entries()) {
        groupedFiles.set(timestep, group.sort(sortByTimestepAndName));
    }

    return groupedFiles;
};
