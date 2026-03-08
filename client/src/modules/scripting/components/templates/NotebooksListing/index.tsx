import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, FolderOpen } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { ScriptingNotebook } from '@/modules/scripting/api/entities/scripting-notebook';
import {
    scriptingNotebooksQuery,
    scriptingNotebooksQueryKey,
    useDeleteScriptingNotebookMutation
} from '@/modules/scripting/hooks/queries';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import DocumentListing, { type ColumnConfig, type SocketInvalidationConfig } from '@/shared/presentation/components/DocumentListing';
import Container from '@/shared/presentation/components/Container';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { sileo } from 'sileo';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import './NotebooksListing.css';

const SOCKET_INVALIDATION: SocketInvalidationConfig[] = [
    { event: 'notebook.deleted', queryKeys: [scriptingNotebooksQueryKey()] }
];

type NotebookDocument = ScriptingNotebook;

const emptyPaginatedResponse = (params: PaginationParams): PaginatedResponse<NotebookDocument> => ({
    status: 'success',
    data: [],
    pagination: {
        page: Math.max(1, Number(params.page) || 1),
        limit: Math.max(1, Number(params.limit) || 20),
        total: 0,
        totalPages: 1,
        hasMore: false
    }
});

const getTrajectoryIds = (notebook: ScriptingNotebook): string[] =>
    Array.isArray(notebook.trajectories)
        ? notebook.trajectories.map((id) => String(id)).filter((id) => id.trim().length > 0)
        : [];

const COLUMNS: ColumnConfig[] = [
    {
        key: 'title',
        title: 'Title',
        sortable: true,
        render: (value, row: any) => {
            return (
                <Container className='d-flex items-center gap-075'>
                    <Container className='d-flex flex-center color-primary'>
                        <BookOpen size={16} />
                    </Container>
                    <Container className='d-flex column gap-025 overflow-hidden'>
                        <span className='font-weight-6 color-primary'>{value as string || 'Untitled Notebook'}</span>
                        <span className='font-size-1 color-muted'>{row._id?.substring(0, 12)}</span>
                    </Container>
                </Container>
            );
        },
        skeleton: { variant: 'text', width: 180 }
    },
    {
        key: 'trajectories',
        title: 'Trajectory ID',
        sortable: false,
        render: (_, row: any) => {
            const trajectoryIds = getTrajectoryIds(row as ScriptingNotebook);
            if (!trajectoryIds.length) {
                return <span className='font-size-2 color-muted'>-</span>;
            }

            const [primaryId, ...rest] = trajectoryIds;
            const label = rest.length ? `${primaryId} +${rest.length}` : primaryId;

            return <span className='font-size-2 color-secondary notebooks-listing-trajectory'>{label}</span>;
        },
        skeleton: { variant: 'text', width: 150 }
    },
    {
        key: 'createdAt',
        title: 'Created',
        sortable: true,
        render: (value) => {
            if (!value) return <span className='font-size-2 color-muted'>-</span>;
            return (
                <span className='font-size-2 color-muted' title={new Date(value as string).toLocaleString()}>
                    {formatDistanceToNow(new Date(value as string), { addSuffix: true })}
                </span>
            );
        },
        skeleton: { variant: 'text', width: 90 }
    }
];

const NotebooksListing = () => {
    const navigate = useNavigate();
    const teamId = useSelectedTeamId();
    const { mutateAsync: deleteNotebook } = useDeleteScriptingNotebookMutation();

    const fetchData = useCallback(async (params: PaginationParams): Promise<PaginatedResponse<NotebookDocument>> => {
        if (!teamId) {
            return emptyPaginatedResponse(params);
        }

        try {
            const result = await scriptingNotebooksQuery.fetch({
                page: params.page,
                limit: params.limit
            });

            const documents = result.data || [];

            return {
                ...result,
                data: documents
            };
        } catch (error) {
            const { default: ApiError } = await import('@/shared/errors/ApiError');
            if(ApiError.isRBACError(error)) throw error;
            sileo.error({ title: 'Failed to fetch notebooks' });
            return emptyPaginatedResponse(params);
        }
    }, [teamId]);

    const { getMenuOptions } = useListingActions<NotebookDocument>({
        actions: {
            open: {
                label: 'Open in Canvas Workspace',
                icon: () => <FolderOpen size={16} />,
                handler: ({ item: notebook }) => {
                    const trajectoryId = getTrajectoryIds(notebook as ScriptingNotebook)[0];
                    if (!trajectoryId) {
                        sileo.error({ title: 'This notebook has no associated trajectory.' });
                        return;
                    }

                    navigate(`/canvas/${trajectoryId}?workspace=scripting&notebook=${encodeURIComponent(notebook._id)}`);
                },
                requiredPermission: 'plugin:read'
            },
            delete: {
                variant: 'danger',
                handler: async ({ item: notebook }) => {
                    await showPromise(
                        deleteNotebook({ notebookId: notebook._id }),
                        {
                            loading: { title: 'Deleting notebook...' },
                            success: { title: 'Notebook deleted successfully' },
                            error: { title: 'Failed to delete notebook' }
                        }
                    );
                },
                confirm: ({ selectedItems }) => (
                    selectedItems.length === 1
                        ? `Delete notebook "${selectedItems[0].title || 'Untitled Notebook'}"? This action cannot be undone.`
                        : `Delete ${selectedItems.length} notebooks? This action cannot be undone.`
                ),
                requiredPermission: 'plugin:delete'
            }
        }
    });

    return (
        <DocumentListing<NotebookDocument>
            title='Notebooks'
            queryKey={scriptingNotebooksQueryKey()}
            columns={COLUMNS}
            fetchData={fetchData}
            getMenuOptions={getMenuOptions}
            emptyMessage='No notebooks found for this team.'
            socketInvalidation={SOCKET_INVALIDATION}
        />
    );
};

export default NotebooksListing;
