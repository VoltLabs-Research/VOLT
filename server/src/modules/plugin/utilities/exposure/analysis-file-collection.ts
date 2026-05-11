export type AnalysisFileType = 'data' | 'chart' | 'model';

export interface AnalysisFileRef {
    bucket: string;
    objectName: string;
    type: AnalysisFileType;
    timestep: number;
}

const sortByTimestepAndName = (left: AnalysisFileRef, right: AnalysisFileRef): number => {
    if (left.timestep !== right.timestep) {
        return left.timestep - right.timestep;
    }

    return left.objectName.localeCompare(right.objectName);
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
