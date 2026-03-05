import { useCallback, useEffect, useState } from 'react';
import PluginCompactTable, { type ColumnConfig } from '@/modules/plugin/presentation/components/organisms/PluginCompactTable';
import { usePluginUseCases } from '@/modules/plugin/presentation/hooks';

interface SubListingTimelinePanelProps {
    analysisId: string;
    exposureId: string;
    subListingName: string;
    currentTimestep: number | undefined;
}

const formatSnakeCaseToTitle = (snakeCase: string): string => {
    return snakeCase
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

const SubListingTimelinePanel = ({
    analysisId,
    exposureId,
    subListingName,
    currentTimestep
}: SubListingTimelinePanelProps) => {
    const { pluginListingRepository } = usePluginUseCases();
    const [columns, setColumns] = useState<ColumnConfig[]>([]);
    const [rows, setRows] = useState<Record<string, unknown>[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchSubListing = useCallback(async () => {
        if (currentTimestep === undefined) return;

        setIsLoading(true);
        setError(null);

        try {
            const result = await pluginListingRepository.getSubListing({
                analysisId,
                exposureId,
                timestep: currentTimestep,
                subListingName
            });

            const normalizedColumns: ColumnConfig[] = (result.columns || []).map((column) => ({
                key: column.label,
                title: formatSnakeCaseToTitle(column.label)
            }));

            setColumns(normalizedColumns);
            setRows(result.rows || []);
        } catch {
            setError(`Failed to load ${formatSnakeCaseToTitle(subListingName)}`);
            setColumns([]);
            setRows([]);
        } finally {
            setIsLoading(false);
        }
    }, [analysisId, exposureId, subListingName, currentTimestep, pluginListingRepository]);

    useEffect(() => {
        fetchSubListing();
    }, [fetchSubListing]);

    return (
        <PluginCompactTable
            columns={columns}
            data={rows}
            isLoading={isLoading}
            error={error}
        />
    );
};

export default SubListingTimelinePanel;
