import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiWifiLine, RiEditLine } from 'react-icons/ri';
import { LuFolderOpen } from 'react-icons/lu';
import { formatDistanceToNow } from 'date-fns';
import DocumentListing, { type ColumnConfig, type ListSyncConfig } from '@/shared/presentation/components/DocumentListing';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import useToast from '@/shared/presentation/hooks/use-toast';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';
import { useSSHUseCases } from '@/modules/ssh/presentation/hooks';
import SSHConnectionModal, { SSH_CONNECTION_MODAL_ID } from '../../molecules/SSHConnectionModal';
import { openModal } from '@/shared/presentation/components/Modal';
import type { SSHConnection } from '@/modules/ssh/domain/entities';

const SSHConnectionsPage = () => {
    const navigate = useNavigate();
    const { showSuccess, showError } = useToast();
    const { sshRepository } = useSSHUseCases();

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
            const result = await sshRepository.testConnection(connection._id);
            if (result.valid) {
                showSuccess(`Connection to "${connection.name}" successful!`);
                return;
            }
            showError(result.error || 'Unknown error');
        } catch (err: unknown) {
            const error = err as Error;
            showError(error.message);
        }
    }, [sshRepository, showSuccess, showError]);

    const handleEditConnection = useCallback((connection: SSHConnection) => {
        setEditingConnection(connection);
        setModalMode('edit');
        setTimeout(() => openModal(SSH_CONNECTION_MODAL_ID), 0);
    }, []);

    const handleDeleteConnection = useCallback(async (connection: SSHConnection) => {
        await sshRepository.deleteConnection(connection._id);
        showSuccess(`Connection "${connection.name}" deleted`);
    }, [sshRepository, showSuccess]);

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
                handler: ({ item }) => handleOpenFileExplorer(item)
            },
            test: {
                label: 'Test Connection',
                icon: RiWifiLine,
                handler: ({ item }) => handleTestConnection(item)
            },
            edit: {
                label: 'Edit',
                icon: RiEditLine,
                handler: ({ item }) => handleEditConnection(item)
            },
            delete: {
                handler: ({ item }) => handleDeleteConnection(item),
                confirm: ({ selectedItems }) => (
                    selectedItems.length === 1
                        ? `Delete connection "${selectedItems[0].name}"? This action cannot be undone.`
                        : `Delete ${selectedItems.length} connections? This action cannot be undone.`
                ),
                variant: 'danger'
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

    const listSyncConfig: ListSyncConfig = useMemo(() => ({
        events: [
            { event: 'ssh-connection.created', action: 'created' },
            { event: 'ssh-connection.deleted', action: 'deleted', getId: (p) => p.sshConnectionId }
        ]
    }), []);

    return (
        <>
            <DocumentListing<SSHConnection>
                title='SSH Connections'
                columns={columns}
                fetchData={fetchData}
                defaultLimit={20}
                getMenuOptions={getMenuOptions}
                emptyMessage='No SSH connections found. Create one to get started.'
                createNew={{
                    buttonTitle: 'Add Connection',
                    onCreate: handleCreateNew
                }}
                listSyncConfig={listSyncConfig}
            />
            <SSHConnectionModal
                connection={editingConnection}
                mode={modalMode}
            />
        </>
    );
};

export default SSHConnectionsPage;
