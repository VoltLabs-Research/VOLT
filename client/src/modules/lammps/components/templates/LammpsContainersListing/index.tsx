import CreateLammpsContainerModal from '@/modules/lammps/components/molecules/CreateLammpsContainerModal';
import useLammpsContainersListing from '@/modules/lammps/hooks/use-lammps-containers-listing';
import { lammpsPackagesQuery } from '@/modules/lammps/hooks/queries';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import Container from '@/shared/presentation/components/Container';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import Title from '@/shared/presentation/components/Title';
import { openModal } from '@/shared/presentation/components/Modal';
import { dateColumn, populatedNameColumn, statusColumn, userColumn } from '@/shared/presentation/utilities/column-presets';
import { Boxes } from 'lucide-react';
import { useMemo } from 'react';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListing';
import type { LammpsContainer } from '@/modules/lammps/api/types';

const CREATE_LAMMPS_CONTAINER_MODAL_ID = 'create-lammps-container-modal';

const renderName: NonNullable<ColumnConfig<LammpsContainer>['render']> = (value, row) => {
    return (
        <Container className='d-flex items-center gap-075'>
            <Container className='d-flex flex-center color-secondary'>
                <Boxes size={16} />
            </Container>
            <Container className='d-flex column gap-025 overflow-hidden'>
                <span className='font-weight-6 color-secondary'>{String(value)}</span>
                <span className='font-size-1 color-muted'>{row._id.substring(0, 12)}</span>
            </Container>
        </Container>
    );
};

const LammpsContainersListing = () => {
    const teamId = useSelectedTeamId();
    const packagesQuery = lammpsPackagesQuery({ teamId: teamId ?? '' }, {
        enabled: Boolean(teamId)
    });
    const {
        canCreate,
        fetchData,
        getMenuOptions,
        queryKey,
        socketInvalidation
    } = useLammpsContainersListing();

    const columns = useMemo<ColumnConfig<LammpsContainer>[]>(() => [
        {
            key: 'name',
            title: 'Container',
            sortable: true,
            render: renderName,
            skeleton: { variant: 'text', width: 220 }
        },
        {
            key: 'packages',
            title: 'Packages',
            sortable: false,
            render: (value) => {
                const packages = Array.isArray(value) ? value as string[] : [];
                return packages.length === 0 ? 'Default' : `${packages.length} selected`;
            },
            skeleton: { variant: 'text', width: 120 }
        },
        statusColumn<LammpsContainer>('status', 'Status', { sortable: true }),
        populatedNameColumn<LammpsContainer>('teamClusterId', 'Compute Cluster', { modelName: 'TeamCluster' }),
        populatedNameColumn<LammpsContainer>('storageClusterId', 'Storage Cluster', { modelName: 'TeamCluster' }),
        userColumn<LammpsContainer>('createdBy', 'Created By'),
        dateColumn<LammpsContainer>('updatedAt', 'Updated At', { width: 120, withTitle: true }),
        dateColumn<LammpsContainer>('createdAt', 'Created At', { width: 120, withTitle: true })
    ], []);

    return (
        <>
            <DocumentListing<LammpsContainer>
                title={<Title className='font-size-6 font-weight-5 sm:font-size-4 color-primary'>LAMMPS Containers</Title>}
                queryKey={queryKey}
                columns={columns}
                fetchData={fetchData}
                getMenuOptions={getMenuOptions}
                createNew={canCreate ? {
                    buttonTitle: 'Create new',
                    onCreate: () => openModal(CREATE_LAMMPS_CONTAINER_MODAL_ID)
                } : undefined}
                emptyMessage='No LAMMPS containers have been provisioned yet.'
                socketInvalidation={socketInvalidation}
            />

            <CreateLammpsContainerModal
                id={CREATE_LAMMPS_CONTAINER_MODAL_ID}
                teamId={teamId}
                packages={packagesQuery.data ?? []}
            />
        </>
    );
};

export default LammpsContainersListing;
