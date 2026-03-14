import { simulationCellsQuery, simulationCellsQueryKey } from '@/modules/simulation-cell/hooks/queries';
import { dateColumn } from '@/shared/presentation/utilities/column-presets';
import { usePageTitle } from '@/shared/presentation/hooks/use-page-title';
import PopulatedCellPopover from '@/shared/presentation/components/PopulatedCellPopover';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import Container from '@/shared/presentation/components/Container';
import './SimulationCellsListing.css';
import { Box } from 'lucide-react';
import type { SimulationCell } from '@/modules/simulation-cell/api/entities/simulation-cell';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListing';
import { formatNumber } from '@/modules/simulation-cell/utilities/format-number';

interface PeriodicAxisStatus {
    axis: 'X' | 'Y' | 'Z';
    enabled: boolean;
};

const LENGTH_UNIT = 'Å';

const formatDimension = (value: number): string => {
    return `${formatNumber(value)} ${LENGTH_UNIT}`;
};

const getPeriodicBoundaryAxes = (cell: SimulationCell): PeriodicAxisStatus[] => {
    const pbc = cell.geometry.periodic_boundary_conditions;
    return [
        { axis: 'X', enabled: pbc.x },
        { axis: 'Y', enabled: pbc.y },
        { axis: 'Z', enabled: pbc.z }
    ];
};

const renderPeriodicBoundary: NonNullable<ColumnConfig<SimulationCell>['render']> = (_, row) => {
    const axes = getPeriodicBoundaryAxes(row);

    return (
        <Container className='d-flex gap-05 flex-wrap'>
            {axes.map((axis) => (
                <span
                    key={axis.axis}
                    className={`simulation-cell-axis-pill font-size-1 ${axis.enabled ? 'is-enabled' : 'is-disabled'}`}
                >
                    {axis.axis}: {axis.enabled ? 'Periodic' : 'Open'}
                </span>
            ))}
        </Container>
    );
};

const COLUMNS: ColumnConfig<SimulationCell>[] = [
    {
        key: 'trajectory.name',
        title: 'Trajectory',
        sortable: true,
        render: (_, row) => (
            <PopulatedCellPopover document={row.trajectory as unknown as Record<string, unknown>} modelName='Trajectory'>
                <span>{row.trajectory.name}</span>
            </PopulatedCellPopover>
        ),
        skeleton: { variant: 'text', width: 120 }
    },
    {
        key: 'timestep',
        title: 'Timestep',
        sortable: true,
        render: (value) => Number(value).toLocaleString(),
        skeleton: { variant: 'text', width: 80 }
    },
    {
        key: 'boundingBox.width',
        title: `Width (${LENGTH_UNIT})`,
        sortable: true,
        render: (_, row) => formatDimension(row.boundingBox.width),
        skeleton: { variant: 'text', width: 80 }
    },
    {
        key: 'boundingBox.height',
        title: `Height (${LENGTH_UNIT})`,
        sortable: true,
        render: (_, row) => formatDimension(row.boundingBox.height),
        skeleton: { variant: 'text', width: 80 }
    },
    {
        key: 'boundingBox.length',
        title: `Length (${LENGTH_UNIT})`,
        sortable: true,
        render: (_, row) => formatDimension(row.boundingBox.length),
        skeleton: { variant: 'text', width: 80 }
    },
    {
        key: 'geometry.periodic_boundary_conditions',
        title: 'Boundary Conditions',
        render: renderPeriodicBoundary,
        skeleton: { variant: 'text', width: 180 }
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
            emptyTitle='No simulation cells yet'
            emptyMessage='Simulation cell geometry appears here after trajectory processing extracts dimensions and boundary conditions for each timestep.'
            emptyIcon={<Box size={28} strokeWidth={1.6} />}
        />
    );
};

export default SimulationCellsListing;
