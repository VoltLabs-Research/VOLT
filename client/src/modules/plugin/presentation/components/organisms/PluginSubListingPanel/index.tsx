import { useCallback, useEffect, useRef, useState } from 'react';
import usePluginUseCases from '@/modules/plugin/presentation/hooks/use-plugin-use-cases';
import PluginCompactTable, { type ColumnConfig } from '@/modules/plugin/presentation/components/organisms/PluginCompactTable';
import formatSnakeCaseToTitle from '@/modules/plugin/presentation/utils/format-snake-case';

interface PluginSubListingPanelProps {
    analysisId: string;
    exposureId: string;
    timestep: number;
    subListingName: string;
}

const PluginSubListingPanel = ({
    analysisId,
    exposureId,
    timestep,
    subListingName
}: PluginSubListingPanelProps) => {
    const { pluginListingRepository } = usePluginUseCases();
    const [columns, setColumns] = useState<ColumnConfig[]>([]);
    const [rows, setRows] = useState<Record<string, unknown>[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchSubListing = useCallback(async (signal: { cancelled: boolean }) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await pluginListingRepository.getSubListing({
                analysisId,
                exposureId,
                timestep,
                subListingName
            });

            if (signal.cancelled) return;

            const mappedColumns: ColumnConfig[] = (response.columns || []).map((column) => ({
                key: column.label,
                title: formatSnakeCaseToTitle(column.label),
                sortable: column.sortable
            }));

            setColumns(mappedColumns);
            setRows(response.rows || []);
        } catch {
            if (signal.cancelled) return;
            setError('Failed to load sub-listing data.');
        } finally {
            if (!signal.cancelled) {
                setIsLoading(false);
            }
        }
    }, [pluginListingRepository, analysisId, exposureId, timestep, subListingName]);

    useEffect(() => {
        const signal = { cancelled: false };

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            fetchSubListing(signal);
        }, 200);

        return () => {
            signal.cancelled = true;
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
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

export default PluginSubListingPanel;
