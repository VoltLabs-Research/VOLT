import { deriveColumns } from '@modules/plugin/dtos/listing-row/DaemonListingTypes';

import type { IAnalysisRepository, ITrajectoryRepository } from '@shared/contracts/ports';
import type { ColumnDef } from '@modules/plugin/dtos/listing-row/GetPluginListingDocumentsDTO';
import type { DaemonListingRow } from '@modules/plugin/dtos/listing-row/DaemonListingTypes';
import type { Analysis } from '@shared/contracts/types';

interface EnrichDaemonListingRowsInput {
    rows: DaemonListingRow[];
    analysisRepository: IAnalysisRepository;
    trajectoryRepository: ITrajectoryRepository;
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
        ? daemonColumns.map((column) => createColumn({ key: column, label: column }))
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
    analysisIds: string[],
    analysisRepository: IAnalysisRepository
): Promise<Map<string, Analysis>> => {
    const analysisList = await analysisRepository.export({
        filter: { _id: { $in: analysisIds } }
    });

    const analyses = new Map<string, Analysis>();
    for (const analysis of analysisList) {
        analyses.set(analysis._id, analysis);
    }

    return analyses;
};

const resolveTrajectoryIds = (rows: DaemonListingRow[], analyses: Map<string, Analysis>): string[] => {
    const ids = new Set<string>();

    for (const row of rows) {
        const analysisId = row.analysis?.trim();
        const analysis = analysisId ? analyses.get(analysisId) : undefined;
        const trajectoryId = row.trajectory?.trim() || analysis?.props.trajectory;

        if (trajectoryId) {
            ids.add(trajectoryId);
        }
    }

    return Array.from(ids);
};

const loadTrajectoryNames = async (
    trajectoryIds: string[],
    trajectoryRepository: ITrajectoryRepository
): Promise<Map<string, string>> => {
    const trajectoryList = await trajectoryRepository.export({
        filter: { _id: { $in: trajectoryIds } }
    });

    const trajectoryNames = new Map<string, string>();
    for (const trajectory of trajectoryList) {
        const trajectoryName = trajectory.props.name?.trim();
        if (!trajectoryName) {
            continue;
        }

        trajectoryNames.set(trajectory._id, trajectoryName);
    }

    return trajectoryNames;
};

export const buildListingColumns = (rows: DaemonListingRow[], daemonColumns?: string[]): ColumnDef[] => {
    return [
        createColumn({ key: TRAJECTORY_COLUMN_KEY, label: 'Trajectory' }),
        createColumn({ key: TIMESTEP_COLUMN_KEY, label: 'Timestep' }),
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
    analysisRepository,
    trajectoryRepository,
    fallbackAnalysisId
}: EnrichDaemonListingRowsInput): Promise<DaemonListingRow[]> => {
    if (rows.length === 0) {
        return rows;
    }

    const analysisIds = resolveAnalysisIds(rows, fallbackAnalysisId);
    const analyses = await loadAnalyses(analysisIds, analysisRepository);
    const trajectoryIds = resolveTrajectoryIds(
        rows.map((row) => ({
            ...row,
            analysis: row.analysis?.trim() || fallbackAnalysisId || row.analysis
        })),
        analyses
    );
    const trajectoryNames = await loadTrajectoryNames(trajectoryIds, trajectoryRepository);

    return rows.map((row) => {
        const analysisId = row.analysis?.trim() || fallbackAnalysisId || '';
        const analysis = analysisId ? analyses.get(analysisId) : undefined;
        const trajectoryId = row.trajectory?.trim() || analysis?.props.trajectory || '';
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
