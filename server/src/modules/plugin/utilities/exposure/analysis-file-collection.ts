import { SYS_BUCKETS } from '@core/config/minio';

import type { IStorageService } from '@shared/domain/port/IStorageService';

export type AnalysisFileType = 'data' | 'chart' | 'model';

export interface AnalysisFileRef {
    bucket: string;
    objectName: string;
    type: AnalysisFileType;
    timestep: number;
}

interface PrefixCollectionConfig {
    bucket: string;
    prefix: string;
    type: AnalysisFileType;
    timestepRegex: RegExp;
    extensionFilter?: string;
}

interface CollectionOptions {
    ignoreErrors?: boolean;
}

const sortByTimestepAndName = (left: AnalysisFileRef, right: AnalysisFileRef): number => {
    if (left.timestep !== right.timestep) {
        return left.timestep - right.timestep;
    }

    return left.objectName.localeCompare(right.objectName);
};

const matchesConfiguredExtension = (objectName: string, extensionFilter?: string): boolean => {
    if (!extensionFilter) {
        return true;
    }

    return objectName.endsWith(extensionFilter);
};

const collectFilesByPrefix = async (
    storageService: IStorageService,
    config: PrefixCollectionConfig,
    options: CollectionOptions = {}
): Promise<AnalysisFileRef[]> => {
    const files: AnalysisFileRef[] = [];

    try {
        for await (const objectName of storageService.listByPrefix(config.bucket, config.prefix, true)) {
            if (!matchesConfiguredExtension(objectName, config.extensionFilter)) {
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
            timestepRegex: /\/timestep-(\d+)\.msgpack\.zst$/,
            extensionFilter: '.msgpack.zst'
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
            extensionFilter: '.glb.zst'
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
