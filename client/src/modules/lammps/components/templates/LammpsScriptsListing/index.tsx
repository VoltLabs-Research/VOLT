import CreateLammpsScriptModal from '@/modules/lammps/components/molecules/CreateLammpsScriptModal';
import LammpsTextPromptModal from '@/modules/lammps/components/molecules/LammpsTextPromptModal';
import useDashboardHeaderContent from '@/modules/dashboard/hooks/use-dashboard-header-content';
import useLammpsScriptsListing, {
    CREATE_LAMMPS_SCRIPT_MODAL_ID,
    MOVE_LAMMPS_SCRIPT_MODAL_ID,
    NEW_LAMMPS_FOLDER_MODAL_ID,
    RENAME_LAMMPS_FOLDER_MODAL_ID,
    RENAME_LAMMPS_SCRIPT_MODAL_ID
} from '@/modules/lammps/hooks/use-lammps-scripts-listing';
import { isLammpsFolderRow, type LammpsListingRow } from '@/modules/lammps/utilities/listing';
import MoveToFolderModal from '@/shared/presentation/components/MoveToFolderModal';
import NewFolderModal from '@/shared/presentation/components/NewFolderModal';
import RenameFolderModal from '@/shared/presentation/components/RenameFolderModal';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import Title from '@/shared/presentation/components/Title';
import { openModal } from '@/shared/presentation/components/Modal';
import { dateColumn, populatedNameColumn, userColumn } from '@/shared/presentation/utilities/column-presets';
import { FileCode2, Folder, Pencil, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import type { ColumnConfig, MenuOption } from '@/shared/presentation/components/DocumentListing';

const renderTitle: NonNullable<ColumnConfig<LammpsListingRow>['render']> = (value, row) => {
    const isFolder = isLammpsFolderRow(row);

    return (
        <Container className='d-flex items-center gap-075'>
            <Container className='d-flex flex-center color-secondary'>
                {isFolder ? <Folder size={16} /> : <FileCode2 size={16} />}
            </Container>
            <Container className='d-flex column gap-025 overflow-hidden'>
                <span className='font-weight-6 color-secondary'>{String(value)}</span>
                <span className='font-size-1 color-muted'>{isFolder ? 'Folder' : row._id.substring(0, 12)}</span>
            </Container>
        </Container>
    );
};

const LammpsScriptsListing = () => {
    const {
        breadcrumbs,
        canCreate,
        containers,
        context,
        currentFolder,
        dragAndDrop,
        fetchData,
        getMenuOptions,
        getMoveFolder,
        handleCreateFolder,
        handleCreateScript,
        handleDeleteCurrentFolder,
        handleItemClick,
        handleMoveScriptClose,
        handleMoveScriptSubmit,
        handleRenameFolderClose,
        handleRenameFolderOpen,
        handleRenameFolderSubmit,
        handleRenameScriptClose,
        handleRenameScriptSubmit,
        listMoveFolders,
        movingScript,
        navigateToFolder,
        queryKey,
        renamingFolder,
        renamingScript,
        teamId
    } = useLammpsScriptsListing();

    const globalSearchBreadcrumb = useMemo(() => ({
        items: breadcrumbs,
        onNavigate: navigateToFolder
    }), [breadcrumbs, navigateToFolder]);

    useDashboardHeaderContent({ globalSearchBreadcrumb });

    const columns = useMemo<ColumnConfig<LammpsListingRow>[]>(() => [
        {
            key: 'title',
            title: 'Title',
            sortable: true,
            render: renderTitle,
            skeleton: { variant: 'text', width: 220 }
        },
        populatedNameColumn<LammpsListingRow>('container', 'Container', { isFolder: isLammpsFolderRow, modelName: 'LammpsContainer' }),
        userColumn<LammpsListingRow>('lastEditedBy', 'Last Edited By', { isFolder: isLammpsFolderRow }),
        userColumn<LammpsListingRow>('createdBy', 'Created By', { isFolder: isLammpsFolderRow }),
        dateColumn<LammpsListingRow>('updatedAt', 'Updated At', { width: 110, withTitle: true }),
        dateColumn<LammpsListingRow>('createdAt', 'Created At', { width: 110, withTitle: true })
    ], []);

    const headerActions = (
        <Button
            variant='ghost'
            intent='neutral'
            size='sm'
            shape='rounded'
            onClick={() => openModal(NEW_LAMMPS_FOLDER_MODAL_ID)}
            title='Create folder'
        >
            <Folder size={14} />
            New Folder
        </Button>
    );

    const headerMenuOptions = useMemo<MenuOption[]>(() => {
        const options: MenuOption[] = [];

        if (currentFolder) {
            options.push(
                {
                    label: 'Rename Folder',
                    icon: Pencil,
                    onClick: () => handleRenameFolderOpen(currentFolder)
                },
                {
                    label: 'Delete Folder',
                    icon: Trash2,
                    onClick: () => handleDeleteCurrentFolder?.(),
                    destructive: true,
                    disabled: !handleDeleteCurrentFolder
                }
            );
        }

        return options;
    }, [currentFolder, handleDeleteCurrentFolder, handleRenameFolderOpen]);

    return (
        <>
            <DocumentListing<LammpsListingRow, { folderId: string | null }>
                title={<Title className='font-size-6 font-weight-5 sm:font-size-4 color-primary'>LAMMPS Scripts</Title>}
                queryKey={queryKey}
                columns={columns}
                context={context}
                fetchData={fetchData}
                getMenuOptions={getMenuOptions}
                onItemClick={handleItemClick}
                dragAndDrop={dragAndDrop}
                createNew={canCreate ? {
                    buttonTitle: 'Create new',
                    onCreate: () => openModal(CREATE_LAMMPS_SCRIPT_MODAL_ID)
                } : undefined}
                headerActions={headerActions}
                headerMenuOptions={headerMenuOptions}
                emptyMessage='No LAMMPS scripts found in this location.'
            />

            <CreateLammpsScriptModal
                id={CREATE_LAMMPS_SCRIPT_MODAL_ID}
                teamId={teamId}
                containers={containers}
                onSubmit={handleCreateScript}
            />
            <LammpsTextPromptModal
                id={RENAME_LAMMPS_SCRIPT_MODAL_ID}
                title='Rename LAMMPS Script'
                description='Update the script title shown in listings and breadcrumbs.'
                fieldLabel='Script title'
                placeholder='Enter a script title'
                submitLabel='Rename Script'
                value={renamingScript?.title ?? ''}
                onSubmit={handleRenameScriptSubmit}
                onClose={handleRenameScriptClose}
            />
            <NewFolderModal
                id={NEW_LAMMPS_FOLDER_MODAL_ID}
                title='New LAMMPS Folder'
                description='Create a folder in the current LAMMPS scripts location.'
                onSubmit={handleCreateFolder}
            />
            <RenameFolderModal
                id={RENAME_LAMMPS_FOLDER_MODAL_ID}
                title='Rename LAMMPS Folder'
                description='Update the current LAMMPS folder name.'
                folderName={renamingFolder?.title ?? null}
                onSubmit={handleRenameFolderSubmit}
                onClose={handleRenameFolderClose}
            />
            <MoveToFolderModal
                id={MOVE_LAMMPS_SCRIPT_MODAL_ID}
                itemId={movingScript?._id ?? null}
                itemName={movingScript?.title ?? null}
                itemLabel='Script'
                sourceFolderId={movingScript?.folder ?? null}
                listFolders={listMoveFolders}
                getFolder={getMoveFolder}
                onSubmit={handleMoveScriptSubmit}
                onClose={handleMoveScriptClose}
            />
        </>
    );
};

export default LammpsScriptsListing;
