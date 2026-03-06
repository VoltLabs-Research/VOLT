import useGetSimulationCells from '../../../hooks/use-get-simulation-cells';
import { usePageTitle } from '@/shared/presentation/hooks/use-page-title';
import DocumentListing, { type ColumnConfig } from '@/shared/presentation/components/DocumentListing';
import { formatNumber } from '@/shared/utils/format';
import type { SimulationCell } from '@/modules/simulation-cell/domain/entities';
import { dateColumn } from '@/shared/presentation/utilities/column-presets';

const formatPeriodicBoundary = (cell: SimulationCell): string => {
    const pbc = cell.geometry.periodic_boundary_conditions;
    return `X: ${pbc.x ? 'Yes' : 'No'}, Y: ${pbc.y ? 'Yes' : 'No'}, Z: ${pbc.z ? 'Yes' : 'No'}`;
};

const COLUMNS: ColumnConfig[] = [
    {
        key: 'trajectory.name',
        title: 'Trajectory',
        sortable: true,
        render: (_, row) => (row as SimulationCell).trajectory.name,
        skeleton: { variant: 'text', width: 120 }
    },
    {
        key: 'timestep',
        title: 'Timestep',
        sortable: true,
        render: (value) => String(value),
        skeleton: { variant: 'text', width: 80 }
    },
    {
        key: 'boundingBox.width',
        title: 'Width',
        sortable: true,
        render: (_, row) => formatNumber((row as SimulationCell).boundingBox.width),
        skeleton: { variant: 'text', width: 80 }
    },
    {
        key: 'boundingBox.height',
        title: 'Height',
        sortable: true,
        render: (_, row) => formatNumber((row as SimulationCell).boundingBox.height),
        skeleton: { variant: 'text', width: 80 }
    },
    {
        key: 'boundingBox.length',
        title: 'Length',
        sortable: true,
        render: (_, row) => formatNumber((row as SimulationCell).boundingBox.length),
        skeleton: { variant: 'text', width: 80 }
    },
    {
        key: 'geometry.periodic_boundary_conditions',
        title: 'Periodic',
        render: (_, row) => formatPeriodicBoundary(row as SimulationCell),
        skeleton: { variant: 'text', width: 120 }
    },
    dateColumn('createdAt', 'Created At')
];

const SimulationCellsListing = () => {
    usePageTitle('Simulation Cells');

    const getSimulationCells = useGetSimulationCells();

    return (
        <DocumentListing<SimulationCell>
            title='Simulation Cells'
            columns={COLUMNS}
            fetchData={getSimulationCells}
            defaultLimit={20}
            emptyMessage='No simulation cells found'
        />
    );
};

export default SimulationCellsListing;
