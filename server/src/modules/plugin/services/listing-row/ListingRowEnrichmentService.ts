import { deriveColumns } from '@modules/plugin/services/listing-row/DaemonListingMapper';

import type { ColumnDef } from '@shared/contracts/operations/GetPluginListingDocuments';
import type { DaemonListingRow } from '@modules/plugin/services/listing-row/DaemonListingMapper';

import AnalysisEntity from '@modules/analysis/models/Analysis';
import TrajectoryEntity from '@modules/trajectory/models/Trajectory';
import { In } from 'typeorm';

interface EnrichDaemonListingRowsInput {
    rows: DaemonListingRow[];
    fallbackAnalysisId?: string;
}

interface ColumnFactoryInput {
    key: string;
    label: string;
    sortable?: boolean;
}

const TRAJECTORY_COLUMN_KEY = 'trajectoryName';
const TIMESTEP_COLUMN_KEY = 'timestep';
const RESERVED_COLUMN_KEYS = new Set([TRAJECTORY_COLUMN_KEY, TIMESTEP_COLUMN_KEY]);

const createColumn = ({ key, label, sortable = true }: ColumnFactoryInput): ColumnDef => {
    return {
        key,
        label,
        sortable
    };
};

const buildDynamicColumns = (rows: DaemonListingRow[], daemonColumns?: string[]): ColumnDef[] => {
    const columns = daemonColumns?.length
        ? daemonColumns.map((column) => createColumn({
            key: column,
            label: column
        }))
        : deriveColumns(rows);

    return columns.filter((column) => !RESERVED_COLUMN_KEYS.has(String(column.key ?? column.label)));
};

const resolveAnalysisIds = (rows: DaemonListingRow[], fallbackAnalysisId?: string): string[] => {
    const ids = new Set<string>();

    for (const row of rows) {
        const analysisId = row.analysis?.trim() || fallbackAnalysisId;
        if (analysisId) {
            ids.add(analysisId);
        }
    }

    return Array.from(ids);
};

const loadAnalyses = async (
    analysisIds: string[]
): Promise<Map<string, AnalysisEntity>> => {
    const analyses = new Map<string, AnalysisEntity>();
    if(analysisIds.length === 0){
        return analyses;
    }

    const analysisList = await AnalysisEntity.findBy({ id: In(analysisIds) });

    for(const analysis of analysisList){
        analyses.set(analysis.id, analysis);
    }

    return analyses;
};

const resolveTrajectoryIds = (rows: DaemonListingRow[], analyses: Map<string, AnalysisEntity>): string[] => {
    const ids = new Set<string>();

    for (const row of rows) {
        const analysisId = row.analysis?.trim();
        const analysis = analysisId ? analyses.get(analysisId) : undefined;
        const trajectoryId = row.trajectory?.trim() || analysis?.trajectory;

        if (trajectoryId) {
            ids.add(trajectoryId);
        }
    }

    return Array.from(ids);
};

const loadTrajectoryNames = async (
    trajectoryIds: string[]
): Promise<Map<string, string>> => {
    const trajectoryNames = new Map<string, string>();
    if(trajectoryIds.length === 0){
        return trajectoryNames;
    }

    const trajectoryList = await TrajectoryEntity.find({
        where: { id: In(trajectoryIds) },
        select: {
            id: true,
            name: true
        }
    });

    for(const trajectory of trajectoryList){
        const trajectoryName = trajectory.name?.trim();
        if(!trajectoryName){
            continue;
        }

        trajectoryNames.set(trajectory.id, trajectoryName);
    }

    return trajectoryNames;
};

export const buildListingColumns = (rows: DaemonListingRow[], daemonColumns?: string[]): ColumnDef[] => {
    return [
        createColumn({
            key: TRAJECTORY_COLUMN_KEY,
            label: 'Trajectory'
        }),
        createColumn({
            key: TIMESTEP_COLUMN_KEY,
            label: 'Timestep'
        }),
        ...buildDynamicColumns(rows, daemonColumns)
    ];
};

export const buildListingExportColumns = (rows: DaemonListingRow[], daemonColumns?: string[]): string[] => {
    const dynamicColumns = buildDynamicColumns(rows, daemonColumns).map((column) => String(column.key ?? column.label));

    return Array.from(new Set([
        '_id',
        'analysisId',
        'trajectoryId',
        'trajectoryName',
        'timestep',
        'exposureId',
        ...dynamicColumns
    ]));
};

export const enrichDaemonListingRows = async ({
    rows,
    fallbackAnalysisId
}: EnrichDaemonListingRowsInput): Promise<DaemonListingRow[]> => {
    if (rows.length === 0) {
        return rows;
    }

    const analysisIds = resolveAnalysisIds(rows, fallbackAnalysisId);
    const analyses = await loadAnalyses(analysisIds);
    const trajectoryIds = resolveTrajectoryIds(
        rows.map((row) => ({
            ...row,
            analysis: row.analysis?.trim() || fallbackAnalysisId || row.analysis
        })),
        analyses
    );
    const trajectoryNames = await loadTrajectoryNames(trajectoryIds);

    return rows.map((row) => {
        const analysisId = row.analysis?.trim() || fallbackAnalysisId || '';
        const analysis = analysisId ? analyses.get(analysisId) : undefined;
        const trajectoryId = row.trajectory?.trim() || analysis?.trajectory || '';
        const trajectoryName = trajectoryNames.get(trajectoryId) || '';

        return {
            ...row,
            analysis: analysisId,
            trajectory: trajectoryId,
            trajectoryName,
            timestep: row.timestep ?? 0
        };
    });
};
