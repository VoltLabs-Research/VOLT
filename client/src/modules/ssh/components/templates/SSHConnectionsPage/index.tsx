import {
    sshConnectionsQuery,
    sshConnectionsQueryKey,
    useDeleteSSHConnectionMutation,
    useTestSSHConnectionMutation
} from '@/modules/ssh/hooks/queries';
import { showPromise } from '@/shared/presentation/hooks/toast';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import useModalForm from '@/shared/presentation/hooks/use-modal-form';
import usePermission from '@/shared/presentation/hooks/use-permission';
import SSHConnectionModal, { SSH_CONNECTION_MODAL_ID } from '../../molecules/SSHConnectionModal';
import { formatDistanceToNow } from 'date-fns';
import { LuFolderOpen } from 'react-icons/lu';
import { RiEditLine, RiWifiLine } from 'react-icons/ri';
import { useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import type { GetSSHConnectionsInputDTO } from '@/modules/ssh/api/dtos/get-ssh-connections';
import type { SSHConnection } from '@/modules/ssh/api/entities/ssh-connection';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { ColumnConfig, SocketInvalidationConfig } from '@/shared/presentation/components/DocumentListing';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';

const SOCKET_INVALIDATION: SocketInvalidationConfig[] = [
    { event: 'ssh-connection.created', queryKeys: [sshConnectionsQueryKey()] },
    { event: 'ssh-connection.deleted', queryKeys: [sshConnectionsQueryKey()] }
];

const SSHConnectionsPage = () => {
    const navigate = useNavigate();
    const testConnectionMutation = useTestSSHConnectionMutation();
    const deleteConnectionMutation = useDeleteSSHConnectionMutation();
    const canCreate = usePermission(['ssh-connection:create']);
    const sshModal = useModalForm({ modalId: SSH_CONNECTION_MODAL_ID });

    const [editingConnection, setEditingConnection] = useState<SSHConnection | null>(null);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');

    const fetchData = async (params: PaginationParams & GetSSHConnectionsInputDTO): Promise<PaginatedResponse<SSHConnection>> => {
        const queryParams: GetSSHConnectionsInputDTO = {
            page: params.page,
            limit: params.limit
        };

        return sshConnectionsQuery.fetch(queryParams);
    };

    const handleOpenFileExplorer = (connection: SSHConnection) => {
        navigate(`/dashboard/ssh-connections/${connection._id}/file-explorer`);
    };

    const handleTestConnection = async (connection: SSHConnection) => {
        try {
            await showPromise(
                testConnectionMutation.mutateAsync({ sshConnectionId: connection._id }),
                {
                    loading: { title: `Testing connection to "${connection.name}"...` },
                    success: (data) => {
                        let title = data.error || 'Unknown error';

                        if (data.valid) {
                            title = `Connection to "${connection.name}" successful!`;
                        }

                        return { title };
                    },
                    error: { title: 'Connection test failed' }
                }
            );
        } catch {
        }
    };

    const handleEditConnection = (connection: SSHConnection) => {
        setEditingConnection(connection);
        setModalMode('edit');
        window.setTimeout(sshModal.open, 0);
    };

    const handleDeleteConnection = async (connection: SSHConnection) => {
        await showPromise(
            deleteConnectionMutation.mutateAsync({ sshConnectionId: connection._id }),
            {
                loading: { title: `Deleting "${connection.name}"...` },
                success: { title: `Connection "${connection.name}" deleted` },
                error: { title: 'Failed to delete connection' }
            }
        );
    };

    const handleCreateNew = () => {
        setEditingConnection(null);
        setModalMode('create');
        window.setTimeout(sshModal.open, 0);
    };

    const getDeleteConfirmation = ({ selectedItems }: { selectedItems: SSHConnection[] }) => {
        let message = `Delete ${selectedItems.length} connections? This action cannot be undone.`;

        if (selectedItems.length === 1) {
            message = `Delete connection "${selectedItems[0].name}"? This action cannot be undone.`;
        }

        return message;
    };

    const { getMenuOptions } = useListingActions<SSHConnection>({
        actions: {
            fileExplorer: {
                label: 'File Explorer',
                icon: LuFolderOpen,
                handler: ({ item }) => handleOpenFileExplorer(item),
                requiredPermission: 'ssh-connection:read'
            },
            test: {
                label: 'Test Connection',
                icon: RiWifiLine,
                handler: ({ item }) => handleTestConnection(item),
                requiredPermission: 'ssh-connection:read'
            },
            edit: {
                label: 'Edit',
                icon: RiEditLine,
                handler: ({ item }) => handleEditConnection(item),
                requiredPermission: 'ssh-connection:update'
            },
            delete: {
                handler: ({ item }) => handleDeleteConnection(item),
                confirm: getDeleteConfirmation,
                variant: 'danger',
                requiredPermission: 'ssh-connection:delete'
            }
        }
    });

    const columns: ColumnConfig[] = useMemo(() => [
        {
            key: 'name',
            title: 'Name',
            sortable: true,
            skeleton: { variant: 'text', width: 150 }
        },
        {
            key: 'host',
            title: 'Host',
            sortable: true,
            skeleton: { variant: 'text', width: 120 }
        },
        {
            key: 'port',
            title: 'Port',
            sortable: true,
            skeleton: { variant: 'text', width: 60 }
        },
        {
            key: 'username',
            title: 'Username',
            sortable: true,
            skeleton: { variant: 'text', width: 100 }
        },
        {
            key: 'createdAt',
            title: 'Created',
            sortable: true,
            render: (value) => formatDistanceToNow(new Date(String(value)), { addSuffix: true }),
            skeleton: { variant: 'text', width: 80 }
        }
    ], []);

    let createNew;
    if (canCreate) {
        createNew = {
            buttonTitle: 'Add Connection',
            onCreate: handleCreateNew
        };
    }

    return (
        <>
            <DocumentListing<SSHConnection>
                title='SSH Connections'
                queryKey={sshConnectionsQueryKey()}
                columns={columns}
                fetchData={fetchData}
                defaultLimit={20}
                getMenuOptions={getMenuOptions}
                emptyMessage='No SSH connections found. Create one to get started.'
                createNew={createNew}
                socketInvalidation={SOCKET_INVALIDATION}
            />
            <SSHConnectionModal
                connection={editingConnection}
                mode={modalMode}
                onSuccess={() => setEditingConnection(null)}
            />
        </>
    );
};

export default SSHConnectionsPage;
