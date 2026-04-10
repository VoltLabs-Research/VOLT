import LammpsTextPromptModal from '@/modules/lammps/components/molecules/LammpsTextPromptModal';
import useLammpsExecHistoryListing from '@/modules/lammps/hooks/use-lammps-exec-history-listing';
import { useImportLammpsExecutionAsTrajectoryMutation } from '@/modules/lammps/hooks/queries';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import Container from '@/shared/presentation/components/Container';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import Title from '@/shared/presentation/components/Title';
import { dateColumn, userColumn } from '@/shared/presentation/utilities/column-presets';
import { openModal } from '@/shared/presentation/components/Modal';
import { DatabaseZap } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { LammpsExecution } from '@/modules/lammps/api/types';
import type { ColumnConfig, MenuOption } from '@/shared/presentation/components/DocumentListing';

const IMPORT_TRAJECTORY_MODAL_ID = 'import-lammps-execution-trajectory-modal';

const renderScript: NonNullable<ColumnConfig<LammpsExecution>['render']> = (_value, row) => {
    const scriptTitle = typeof row.script === 'string' ? row.script : row.script?.title;

    return (
        <Container className='d-flex items-center gap-075'>
            <Container className='d-flex flex-center color-secondary'>
                <DatabaseZap size={16} />
            </Container>
            <Container className='d-flex column gap-025 overflow-hidden'>
                <span className='font-weight-6 color-secondary'>{scriptTitle ?? 'Unknown Script'}</span>
                <span className='font-size-1 color-muted'>{row._id.substring(0, 12)}</span>
            </Container>
        </Container>
    );
};

const LammpsExecHistoryListing = () => {
    const teamId = useSelectedTeamId();
    const importMutation = useImportLammpsExecutionAsTrajectoryMutation();
    const [importTarget, setImportTarget] = useState<LammpsExecution | null>(null);
    const {
        fetchData,
        getMenuOptions: getBaseMenuOptions,
        queryKey
    } = useLammpsExecHistoryListing();

    const columns = useMemo<ColumnConfig<LammpsExecution>[]>(() => [
        {
            key: 'script',
            title: 'Script',
            sortable: false,
            render: renderScript,
            skeleton: { variant: 'text', width: 220 }
        },
        {
            key: 'dumpCount',
            title: 'Dumps',
            sortable: true,
            render: (value) => String(value ?? 0),
            skeleton: { variant: 'text', width: 70 }
        },
        userColumn<LammpsExecution>('requestedBy', 'By'),
        dateColumn<LammpsExecution>('startedAt', 'Started At', { width: 120, withTitle: true }),
        dateColumn<LammpsExecution>('finishedAt', 'Finished At', { width: 120, withTitle: true })
    ], []);

    const getMenuOptions = useMemo(() => {
        return (item: LammpsExecution, selectedItems: LammpsExecution[]): MenuOption[] => {
            const baseOptions = getBaseMenuOptions(item, selectedItems).filter((option) => option.label !== 'Import as trajectory');

            baseOptions.splice(1, 0, {
                label: 'Import as Trajectory',
                onClick: () => {
                    setImportTarget(item);
                    openModal(IMPORT_TRAJECTORY_MODAL_ID);
                },
                disabled: item.status !== 'completed'
            });

            return baseOptions;
        };
    }, [getBaseMenuOptions]);

    return (
        <>
            <DocumentListing<LammpsExecution>
                title={<Title className='font-size-6 font-weight-5 sm:font-size-4 color-primary'>LAMMPS Execution History</Title>}
                queryKey={queryKey}
                columns={columns}
                fetchData={fetchData}
                getMenuOptions={getMenuOptions}
                emptyMessage='No LAMMPS executions have been recorded yet.'
            />

            <LammpsTextPromptModal
                id={IMPORT_TRAJECTORY_MODAL_ID}
                title='Import Execution as Trajectory'
                description='The imported trajectory will reference all generated dumps from this completed execution.'
                fieldLabel='Trajectory name'
                placeholder='Enter a trajectory name'
                submitLabel='Import'
                value={importTarget ? `${typeof importTarget.script === 'string' ? importTarget.script : importTarget.script?.title ?? 'trajectory'}-${importTarget._id.slice(0, 6)}` : ''}
                onSubmit={async (name) => {
                    if (!teamId || !importTarget) {
                        return;
                    }

                    await importMutation.mutateAsync({
                        teamId,
                        executionId: importTarget._id,
                        name
                    });
                }}
                onClose={() => setImportTarget(null)}
            />
        </>
    );
};

export default LammpsExecHistoryListing;
