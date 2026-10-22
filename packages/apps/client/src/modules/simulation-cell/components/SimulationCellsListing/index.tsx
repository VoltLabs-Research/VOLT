import { simulationCellsQuery, simulationCellsQueryKey } from '@/modules/simulation-cell/hooks/queries';
import { dateColumn } from '@/shared/ui/utils/column-presets';
import { usePageTitle } from '@/shared/ui/hooks/use-page-title';
import PopulatedCellPopover from '@/shared/ui/components/PopulatedCellPopover';
import DocumentListing from '@/shared/ui/components/DocumentListing';
import { Chip } from '@heroui/react';
import { Box } from 'lucide-react';
import type { SimulationCell } from '@volt/contracts/modules/simulation-cell/domain';
import type { ColumnConfig } from '@/shared/ui/components/DocumentListingTable';

const LENGTH_UNIT = 'Å';

// The header carries the unit, so a cell is only the value.
const formatDimension = (value: number): string => value.toFixed(3);

const AXES = ['x', 'y', 'z'] as const;

// A fully periodic box, the usual case, is one chip; an open axis is spelled out per axis.
const renderPeriodicBoundary: NonNullable<ColumnConfig<SimulationCell>['render']> = (_, row) => {
    const pbc = row.geometry.periodic_boundary_conditions;

    if (AXES.every((axis) => pbc[axis])) {
        return (
            <Chip size='sm' variant='soft'>
                <Chip.Label>Periodic · X Y Z</Chip.Label>
            </Chip>
        );
    }

    return (
        <div className='flex flex-row flex-wrap items-center gap-1'>
            {AXES.map((axis) => (
                <Chip
                    key={axis}
                    size='sm'
                    variant={pbc[axis] ? 'soft' : 'tertiary'}
                    className={pbc[axis] ? undefined : 'text-muted'}
                >
                    <Chip.Label>
                        {axis.toUpperCase()}: {pbc[axis] ? 'Periodic' : 'Open'}
                    </Chip.Label>
                </Chip>
            ))}
        </div>
    );
};

const DIMENSION_CELL_CLASS = 'font-mono';

const COLUMNS: ColumnConfig<SimulationCell>[] = [
    {
        key: 'trajectory.name',
        title: 'Trajectory',
        sortable: true,
        render: (_, row) => (
            <PopulatedCellPopover document={row.trajectory} modelName='Trajectory'>
                <span className='font-medium text-foreground'>{row.trajectory.name}</span>
            </PopulatedCellPopover>
        ),
        skeleton: {
            variant: 'text',
            width: 120
        }
    },
    {
        key: 'timestep',
        title: 'Timestep',
        sortable: true,
        numeric: true,
        render: (value) => Number(value).toLocaleString(),
        skeleton: {
            variant: 'text',
            width: 80
        }
    },
    {
        key: 'boundingBox.width',
        title: `Width (${LENGTH_UNIT})`,
        sortable: true,
        numeric: true,
        render: (_, row) => <span className={DIMENSION_CELL_CLASS}>{formatDimension(row.boundingBox.width)}</span>,
        skeleton: {
            variant: 'text',
            width: 80
        }
    },
    {
        key: 'boundingBox.height',
        title: `Height (${LENGTH_UNIT})`,
        sortable: true,
        numeric: true,
        render: (_, row) => <span className={DIMENSION_CELL_CLASS}>{formatDimension(row.boundingBox.height)}</span>,
        skeleton: {
            variant: 'text',
            width: 80
        }
    },
    {
        key: 'boundingBox.length',
        title: `Length (${LENGTH_UNIT})`,
        sortable: true,
        numeric: true,
        render: (_, row) => <span className={DIMENSION_CELL_CLASS}>{formatDimension(row.boundingBox.length)}</span>,
        skeleton: {
            variant: 'text',
            width: 80
        }
    },
    {
        key: 'geometry.periodic_boundary_conditions',
        title: 'Boundary Conditions',
        render: renderPeriodicBoundary,
        skeleton: {
            variant: 'text',
            width: 180
        }
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
            description='The simulation box of every processed frame, in ångströms, with its boundary conditions.'
            emptyTitle='No simulation cells yet'
            emptyMessage='Simulation cell geometry appears here after trajectory processing extracts dimensions and boundary conditions for each timestep.'
            emptyIcon={<Box size={28} strokeWidth={1.6} />}
        />
    );
};

export default SimulationCellsListing;
