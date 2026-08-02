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

const TRAJECTORY_COLUMN_KEY = 'trajectoryName';
const TIMESTEP_COLUMN_KEY = 'timestep';
const RESERVED_COLUMN_KEYS = new Set([TRAJECTORY_COLUMN_KEY, TIMESTEP_COLUMN_KEY]);

const columnKeyOf = (column: ColumnDef): string => column.key ?? column.label;

const buildDynamicColumns = (rows: DaemonListingRow[], daemonColumns?: string[]): ColumnDef[] => {
    const columns = daemonColumns?.length
        ? daemonColumns.map((column) => ({
            key: column,
            label: column,
            sortable: true
        }))
        : deriveColumns(rows);

    return columns.filter((column) => !RESERVED_COLUMN_KEYS.has(columnKeyOf(column)));
};

const loadAnalyses = async (analysisIds: Set<string>): Promise<Map<string, AnalysisEntity>> => {
    if(analysisIds.size === 0){
        return new Map();
    }

    const analyses = await AnalysisEntity.findBy({ id: In([...analysisIds]) });

    return new Map(analyses.map((analysis) => [analysis.id, analysis]));
};

const loadTrajectoryNames = async (trajectoryIds: Set<string>): Promise<Map<string, string>> => {
    if(trajectoryIds.size === 0){
        return new Map();
    }

    const trajectories = await TrajectoryEntity.find({
        where: { id: In([...trajectoryIds]) },
        select: {
            id: true,
            name: true
        }
    });

    return new Map(
        trajectories
            .map((trajectory): [string, string] => [trajectory.id, trajectory.name?.trim() ?? ''])
            .filter(([, name]) => name.length > 0)
    );
};

export const buildListingColumns = (rows: DaemonListingRow[], daemonColumns?: string[]): ColumnDef[] => {
    return [
        {
            key: TRAJECTORY_COLUMN_KEY,
            label: 'Trajectory',
            sortable: true
        },
        {
            key: TIMESTEP_COLUMN_KEY,
            label: 'Timestep',
            sortable: true
        },
        ...buildDynamicColumns(rows, daemonColumns)
    ];
};

export const buildListingExportColumns = (rows: DaemonListingRow[]): string[] => {
    return Array.from(new Set([
        '_id',
        'analysisId',
        'trajectoryId',
        'trajectoryName',
        'timestep',
        'exposureId',
        ...buildDynamicColumns(rows).map(columnKeyOf)
    ]));
};

/**
 * Daemon rows only carry ids, and may omit the analysis when the caller already
 * knows it. Each row is resolved to its analysis and trajectory once, then the
 * trajectory names are looked up in a single query and stamped onto the rows.
 */
export const enrichDaemonListingRows = async ({
    rows,
    fallbackAnalysisId
}: EnrichDaemonListingRowsInput): Promise<DaemonListingRow[]> => {
    if (rows.length === 0) {
        return rows;
    }

    const analysisIdByRow = rows.map((row) => row.analysis?.trim() || fallbackAnalysisId || '');
    const analyses = await loadAnalyses(new Set(analysisIdByRow.filter(Boolean)));

    const trajectoryIdByRow = rows.map((row, index) => {
        return row.trajectory?.trim() || analyses.get(analysisIdByRow[index])?.trajectory || '';
    });
    const trajectoryNames = await loadTrajectoryNames(new Set(trajectoryIdByRow.filter(Boolean)));

    return rows.map((row, index) => ({
        ...row,
        analysis: analysisIdByRow[index],
        trajectory: trajectoryIdByRow[index],
        trajectoryName: trajectoryNames.get(trajectoryIdByRow[index]) || '',
        timestep: row.timestep ?? 0
    }));
};
