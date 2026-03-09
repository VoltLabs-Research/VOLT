import { simulationCellsQuery, simulationCellsQueryKey } from '@/modules/simulation-cell/hooks/queries';
import { dateColumn } from '@/shared/presentation/utilities/column-presets';
import { usePageTitle } from '@/shared/presentation/hooks/use-page-title';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import type { SimulationCell } from '@/modules/simulation-cell/api/entities/simulation-cell';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListing';
import { formatNumber } from '@/modules/simulation-cell/utilities/format-number';

const formatPeriodicBoundary = (cell: SimulationCell): string => {
    const pbc = cell.geometry.periodic_boundary_conditions;
    return `X: ${pbc.x ? 'Yes' : 'No'}, Y: ${pbc.y ? 'Yes' : 'No'}, Z: ${pbc.z ? 'Yes' : 'No'}`;
};

const COLUMNS: ColumnConfig<SimulationCell>[] = [
    {
        key: 'trajectory.name',
        title: 'Trajectory',
        sortable: true,
        render: (_, row) => row.trajectory.name,
        skeleton: { variant: 'text', width: 120 }
    },
    {
        key: 'timestep',
        title: 'Timestep',
        sortable: true,
        render: String,
        skeleton: { variant: 'text', width: 80 }
    },
    {
        key: 'boundingBox.width',
        title: 'Width',
        sortable: true,
        render: (_, row) => formatNumber(row.boundingBox.width),
        skeleton: { variant: 'text', width: 80 }
    },
    {
        key: 'boundingBox.height',
        title: 'Height',
        sortable: true,
        render: (_, row) => formatNumber(row.boundingBox.height),
        skeleton: { variant: 'text', width: 80 }
    },
    {
        key: 'boundingBox.length',
        title: 'Length',
        sortable: true,
        render: (_, row) => formatNumber(row.boundingBox.length),
        skeleton: { variant: 'text', width: 80 }
    },
    {
        key: 'geometry.periodic_boundary_conditions',
        title: 'Periodic',
        render: (_, row) => formatPeriodicBoundary(row),
        skeleton: { variant: 'text', width: 120 }
    },
    dateColumn<SimulationCell>('createdAt', 'Created At', { sortable: false })
];

const SimulationCellsListing = () => {
    usePageTitle('Simulation Cells');

    return (
        <DocumentListing<SimulationCell>
            title='Simulation Cells'
            queryKey={simulationCellsQueryKey()}
            columns={COLUMNS}
            fetchData={simulationCellsQuery.fetch}
            defaultLimit={20}
            emptyMessage='No simulation cells found'
        />
    );
};

export default SimulationCellsListing;
