import useDashboardHeaderContent from '@/modules/dashboard/hooks/use-dashboard-header-content';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import FolderNameModal from '@/shared/presentation/components/FolderNameModal';
import MoveToFolderModal from '@/shared/presentation/components/MoveToFolderModal';
import { Box, Row } from '@voltstack/bravais';
import type { DocumentListingDragAndDropConfig } from '@/shared/presentation/components/DocumentListing/drag-and-drop';
import { dateColumn, userColumn } from '@/shared/presentation/utilities/column-presets';
import { Folder } from 'lucide-react';
import { useMemo } from 'react';
import type { SocketInvalidationConfig } from '@/shared/presentation/components/DocumentListing';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListingTable';
import type { MenuOption } from '@/shared/presentation/types/menu';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type {
    FolderBreadcrumbEntity,
    FolderBreadcrumbItem
} from '@/shared/presentation/hooks/use-folder-breadcrumbs';
import type { FolderedListingResource } from '@/shared/presentation/hooks/foldered-resource-listing-helpers';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';
import type { MouseEvent, ReactNode } from 'react';
import type { QueryKey } from '@tanstack/react-query';

interface FolderedListingRow {
    _id: string;
    name?: string | null;
    title?: string | null;
    folder?: string | null;
};

interface FolderedListingTitleOptions<TRow> {
    key?: string;
    title?: string;
    isFolder: (row: TRow) => boolean;
    resolveTitle: (row: TRow) => string;
    skeletonWidth: number;
    wrapperClassName?: string;
    titleClassName?: string;
    getAriaLabel?: (row: TRow) => string | undefined;
    showTitleAttribute?: boolean;
};

interface FolderedListingState<TRow extends { _id: string }, TContext> {
    queryKey: QueryKey;
    context: TContext;
    fetchData: (params: PaginationParams & TContext) => Promise<PaginatedResponse<TRow>>;
    getMenuOptions: (item: TRow, selectedItems: TRow[]) => MenuOption[];
    handleItemClick: (item: TRow, event: MouseEvent) => boolean;
    dragAndDrop?: DocumentListingDragAndDropConfig<TRow>;
    handleCreate: () => void;
    socketInvalidation?: SocketInvalidationConfig[];
};

interface FolderedDocumentListingProps<TRow extends { _id: string }, TContext> {
    title: ReactNode;
    columns: ColumnConfig<TRow>[];
    listing: FolderedListingState<TRow, TContext>;
    createButtonTitle?: string;
    defaultLimit?: number;
    headerActions: ReactNode;
    headerMenuOptions: MenuOption[];
    emptyMessage?: string;
    emptyTitle?: string;
    emptyIcon?: ReactNode;
    emptyButtonText?: string;
    emptyButtonIsLoading?: boolean;
    onEmptyButtonClick?: () => void;
};

interface FolderedListingModalsListing<TFolder extends FolderBreadcrumbEntity> {
    handleCreateFolder: (folderName: string) => Promise<void>;
    renamingFolder: TFolder | null;
    handleRenameFolderSubmit: (folderName: string) => Promise<void>;
    handleRenameFolderClose: () => void;
    movingItem: FolderedListingRow | null;
    listMoveFolders: (parentId: string | null) => Promise<TFolder[]>;
    getMoveFolder: (folderId: string) => Promise<TFolder>;
    handleMoveSubmit: (folderId: string | null) => Promise<void>;
    handleMoveClose: () => void;
}

interface FolderedListingModalsProps<TFolder extends FolderBreadcrumbEntity> {
    resource: FolderedListingResource;
    listing: FolderedListingModalsListing<TFolder>;
}

export const createFolderedTitleColumn = <TRow,>({
    key = 'title',
    title = 'Title',
    isFolder,
    resolveTitle,
    skeletonWidth,
    wrapperClassName,
    titleClassName = 'font-weight-6 color-secondary',
    getAriaLabel,
    showTitleAttribute = false
}: FolderedListingTitleOptions<TRow>): ColumnConfig<TRow> => {
    const render: NonNullable<ColumnConfig<TRow>['render']> = (value, row) => {
        let title = resolveTitle(row);

        if (typeof value === 'string' && value.trim().length > 0) {
            title = value;
        }

        return (
            <Row gap='075' className={wrapperClassName} aria-label={getAriaLabel?.(row)}>
                {isFolder(row) && (
                    <Box display='flex' className='flex-center color-secondary'>
                        <Folder size={16} />
                    </Box>
                )}
                <Box overflow='hidden' minW='0'>
                    <span className={titleClassName} title={showTitleAttribute ? title : undefined}>
                        {title}
                    </span>
                </Box>
            </Row>
        );
    };

    return {
        key,
        title,
        sortable: true,
        render,
        skeleton: { variant: 'text', width: skeletonWidth }
    };
};

export const createFolderedListingColumns = <TRow,>(options: FolderedListingTitleOptions<TRow>): ColumnConfig<TRow>[] => {
    return [
        createFolderedTitleColumn(options),
        userColumn<TRow>('lastEditedBy', 'Last Edited By', { isFolder: options.isFolder }),
        dateColumn<TRow>('updatedAt', 'Updated At', {
            width: 110,
            withTitle: true
        })
    ];
};

export const useFolderedListingDashboardBreadcrumb = (
    breadcrumbs: FolderBreadcrumbItem[],
    navigateToFolder: (folderId: string | null) => void
) => {
    const globalSearchBreadcrumb = useMemo(() => ({
        items: breadcrumbs,
        onNavigate: navigateToFolder
    }), [breadcrumbs, navigateToFolder]);

    useDashboardHeaderContent({
        globalSearchBreadcrumb
    });
};

export const FolderedDocumentListing = <TRow extends { _id: string }, TContext>({
    title,
    columns,
    listing,
    createButtonTitle,
    defaultLimit,
    headerActions,
    headerMenuOptions,
    emptyMessage,
    emptyTitle,
    emptyIcon,
    emptyButtonText,
    emptyButtonIsLoading,
    onEmptyButtonClick
}: FolderedDocumentListingProps<TRow, TContext>) => (
    <DocumentListing<TRow, TContext>
        title={title}
        queryKey={listing.queryKey}
        columns={columns}
        context={listing.context}
        fetchData={listing.fetchData}
        defaultLimit={defaultLimit}
        getMenuOptions={listing.getMenuOptions}
        onItemClick={listing.handleItemClick}
        dragAndDrop={listing.dragAndDrop}
        createNew={createButtonTitle ? {
            buttonTitle: createButtonTitle,
            onCreate: listing.handleCreate
        } : undefined}
        headerActions={headerActions}
        headerMenuOptions={headerMenuOptions}
        emptyMessage={emptyMessage}
        emptyTitle={emptyTitle}
        emptyIcon={emptyIcon}
        emptyButtonText={emptyButtonText}
        emptyButtonIsLoading={emptyButtonIsLoading}
        onEmptyButtonClick={onEmptyButtonClick}
        socketInvalidation={listing.socketInvalidation}
    />
);

export const FolderedListingModals = <TFolder extends FolderBreadcrumbEntity>({
    resource: { modalIds, copy },
    listing
}: FolderedListingModalsProps<TFolder>): ReactNode => (
    <>
        <FolderNameModal
            id={modalIds.newFolder}
            title={copy.newFolderTitle}
            description={copy.newFolderDescription}
            onSubmit={listing.handleCreateFolder}
        />
        <FolderNameModal
            id={modalIds.renameFolder}
            title={copy.renameFolderTitle}
            description={copy.renameFolderDescription}
            initialName={listing.renamingFolder?.title ?? null}
            onSubmit={listing.handleRenameFolderSubmit}
            onClose={listing.handleRenameFolderClose}
        />
        <MoveToFolderModal
            id={modalIds.move}
            itemId={listing.movingItem?._id ?? null}
            itemName={listing.movingItem?.title ?? listing.movingItem?.name ?? null}
            itemLabel={copy.itemLabel}
            sourceFolderId={listing.movingItem?.folder ?? null}
            listFolders={listing.listMoveFolders}
            getFolder={listing.getMoveFolder}
            onSubmit={listing.handleMoveSubmit}
            onClose={listing.handleMoveClose}
        />
    </>
);
