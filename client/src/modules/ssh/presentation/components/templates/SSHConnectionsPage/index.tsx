import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiWifiLine, RiEditLine } from 'react-icons/ri';
import { LuFolderOpen } from 'react-icons/lu';
import { formatDistanceToNow } from 'date-fns';
import DocumentListing, { type ColumnConfig, createListSyncConfig } from '@/shared/presentation/components/DocumentListing';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import usePermission from '@/shared/presentation/hooks/use-permission';
import { showPromise } from '@/shared/presentation/hooks/toast';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';
import { useSSHUseCases } from '@/modules/ssh/presentation/hooks';
import SSHConnectionModal, { SSH_CONNECTION_MODAL_ID } from '../../molecules/SSHConnectionModal';
import { openModal } from '@/shared/presentation/components/Modal';
import type { SSHConnection } from '@/modules/ssh/domain/entities';

const LIST_SYNC = createListSyncConfig('ssh-connection');

const SSHConnectionsPage = () => {
    const navigate = useNavigate();
    const { sshRepository } = useSSHUseCases();
    const canCreate = usePermission(['ssh-connection:create']);

    const [editingConnection, setEditingConnection] = useState<SSHConnection | null>(null);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');

    const fetchData = useCallback(async (params: PaginationParams) => {
        return await sshRepository.getConnections({
            page: params.page,
            limit: params.limit
        });
    }, [sshRepository]);

    const handleOpenFileExplorer = useCallback((connection: SSHConnection) => {
        navigate(`/dashboard/ssh-connections/${connection._id}/file-explorer`);
    }, [navigate]);

    const handleTestConnection = useCallback(async (connection: SSHConnection) => {
        try {
            const result = await showPromise(
                sshRepository.testConnection(connection._id),
                {
                    loading: { title: `Testing connection to "${connection.name}"...` },
                    success: (data) => ({
                        title: data.valid
                            ? `Connection to "${connection.name}" successful!`
                            : (data.error || 'Unknown error')
                    }),
                    error: { title: 'Connection test failed' }
                }
            );
            return result;
        } catch {
            // Error already shown by showPromise
        }
    }, [sshRepository]);

    const handleEditConnection = useCallback((connection: SSHConnection) => {
        setEditingConnection(connection);
        setModalMode('edit');
        setTimeout(() => openModal(SSH_CONNECTION_MODAL_ID), 0);
    }, []);

    const handleDeleteConnection = useCallback(async (connection: SSHConnection) => {
        await showPromise(
            sshRepository.deleteConnection(connection._id),
            {
                loading: { title: `Deleting "${connection.name}"...` },
                success: { title: `Connection "${connection.name}" deleted` },
                error: { title: 'Failed to delete connection' }
            }
        );
    }, [sshRepository]);

    const handleCreateNew = useCallback(() => {
        setEditingConnection(null);
        setModalMode('create');
        setTimeout(() => openModal(SSH_CONNECTION_MODAL_ID), 0);
    }, []);

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
                confirm: ({ selectedItems }) => (
                    selectedItems.length === 1
                        ? `Delete connection "${selectedItems[0].name}"? This action cannot be undone.`
                        : `Delete ${selectedItems.length} connections? This action cannot be undone.`
                ),
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
            render: (value) => formatDistanceToNow(new Date(value as string), { addSuffix: true }),
            skeleton: { variant: 'text', width: 80 }
        }
    ], []);

    return (
        <>
            <DocumentListing<SSHConnection>
                title='SSH Connections'
                columns={columns}
                fetchData={fetchData}
                defaultLimit={20}
                getMenuOptions={getMenuOptions}
                emptyMessage='No SSH connections found. Create one to get started.'
                createNew={canCreate ? {
                    buttonTitle: 'Add Connection',
                    onCreate: handleCreateNew
                } : undefined}
                listSyncConfig={LIST_SYNC}
            />
            <SSHConnectionModal
                connection={editingConnection}
                mode={modalMode}
            />
        </>
    );
};

export default SSHConnectionsPage;
