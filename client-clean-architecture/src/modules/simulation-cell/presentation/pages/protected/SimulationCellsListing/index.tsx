import { useMemo, useEffect } from 'react';
import { usePageTitle } from '@/shared/presentation/hooks/core/use-page-title';
import DocumentListing, { type ColumnConfig } from '@/shared/presentation/components/organisms/common/DocumentListing';
import { useTeamStore } from '@/modules/team/presentation/stores';
import { useSimulationCellStore } from '../../../stores';
import { formatDistanceToNow } from 'date-fns';

const formatNumber = (value: number | undefined): string => {
    if (value === undefined || value === null) return '-';
    return value.toFixed(2);
};

const SimulationCellsListing = () => {
    usePageTitle('Simulation Cells');
    const team = useTeamStore((s) => s.selectedTeam);

    const simulationCells = useSimulationCellStore((s) => s.simulationCells);
    const isLoading = useSimulationCellStore((s) => s.isLoading);
    const listingMeta = useSimulationCellStore((s) => s.listingMeta);
    const fetchSimulationCells = useSimulationCellStore((s) => s.fetchSimulationCells);
    const resetSimulationCells = useSimulationCellStore((s) => s.resetSimulationCells);

    useEffect(() => {
        if (team?._id) {
            fetchSimulationCells(team._id, { page: 1, limit: 20 });
        }
    }, [team?._id, fetchSimulationCells]);

    useEffect(() => {
        return () => {
            resetSimulationCells();
        };
    }, [resetSimulationCells]);

    const handleLoadMore = () => {
        if (team?._id && listingMeta.hasMore) {
            fetchSimulationCells(team._id, {
                page: listingMeta.page + 1,
                limit: listingMeta.limit,
                append: true
            });
        }
    };

    const columns: ColumnConfig[] = useMemo(() => [
        {
            title: 'Trajectory',
            key: 'trajectory.name',
            render: (_, row) => row.trajectory?.name || '-',
            skeleton: { variant: 'text', width: 120 }
        },
        {
            title: 'Timestep',
            key: 'timestep',
            render: (_, row) => row.timestep,
            skeleton: { variant: 'text', width: 80 }
        },
        {
            title: 'Width',
            key: 'boundingBox.width',
            render: (_, row) => formatNumber(row.boundingBox?.width),
            skeleton: { variant: 'text', width: 80 }
        },
        {
            title: 'Height',
            key: 'boundingBox.height',
            render: (_, row) => formatNumber(row.boundingBox?.height),
            skeleton: { variant: 'text', width: 80 }
        },
        {
            title: 'Length',
            key: 'boundingBox.length',
            render: (_, row) => formatNumber(row.boundingBox?.length),
            skeleton: { variant: 'text', width: 80 }
        },
        {
            title: 'Periodic',
            key: 'geometry.periodic_boundary_conditions',
            render: (_, row) => {
                const { x, y, z } = row.geometry?.periodic_boundary_conditions || {};
                return `X: ${x ? 'Yes' : 'No'}, Y: ${y ? 'Yes' : 'No'}, Z: ${z ? 'Yes' : 'No'}`;
            },
            skeleton: { variant: 'text', width: 120 }
        },
        {
            title: 'Created At',
            key: 'createdAt',
            render: (v) => formatDistanceToNow(new Date(v), { addSuffix: true }),
            skeleton: { variant: 'text', width: 90 }
        }
    ], []);

    return (
        <DocumentListing
            title={`Simulation Cells (${listingMeta.total || simulationCells.length})`}
            columns={columns}
            data={simulationCells}
            isLoading={isLoading}
            emptyMessage='No simulation cells found'
            hasMore={listingMeta.hasMore}
            onLoadMore={handleLoadMore}
        />
    );
};

export default SimulationCellsListing;
