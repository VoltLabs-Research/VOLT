import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiWifiLine, RiEditLine } from 'react-icons/ri';
import { LuFolderOpen } from 'react-icons/lu';
import DocumentListing, { type ColumnConfig } from '@/shared/presentation/components/DocumentListing';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import useToast from '@/shared/presentation/hooks/use-toast';
import { useSSHUseCases } from '@/modules/ssh/presentation/hooks';
import SSHConnectionModal, { SSH_CONNECTION_MODAL_ID } from '../../molecules/SSHConnectionModal';
import { openModal } from '@/shared/presentation/components/Modal';
import { formatRelativeDate } from '@/shared/utils/format';
import type { SSHConnection } from '@/modules/ssh/domain/entities';

const SSHConnectionsPage = () => {
    const navigate = useNavigate();
    const { showSuccess, showError } = useToast();
    const { sshRepository } = useSSHUseCases();

    const [editingConnection, setEditingConnection] = useState<SSHConnection | null>(null);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [refreshKey, setRefreshKey] = useState(0);

    const fetchData = useCallback(async (params: { page: number; limit: number }) => {
        return await sshRepository.getConnections(params);
    }, [sshRepository]);

    const handleOpenFileExplorer = useCallback((connection: SSHConnection) => {
        navigate(`/dashboard/ssh-connections/${connection._id}/file-explorer`);
    }, [navigate]);

    const handleTestConnection = useCallback(async (connection: SSHConnection) => {
        try {
            const result = await sshRepository.testConnection(connection._id);
            if (result.valid) {
                showSuccess(`Connection to "${connection.name}" successful!`);
            } else {
                showError(result.error || `Connection to "${connection.name}" failed`);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Connection test failed';
            showError(message);
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
        setRefreshKey((k) => k + 1);
    }, [sshRepository, showSuccess]);

    const handleCreateNew = useCallback(() => {
        setEditingConnection(null);
        setModalMode('create');
        setTimeout(() => openModal(SSH_CONNECTION_MODAL_ID), 0);
    }, []);

    const handleModalSuccess = useCallback(() => {
        setRefreshKey((k) => k + 1);
    }, []);

    const { getMenuOptions } = useListingActions<SSHConnection>({
        actions: {
            fileExplorer: {
                label: 'File Explorer',
                icon: LuFolderOpen,
                handler: handleOpenFileExplorer
            },
            test: {
                label: 'Test Connection',
                icon: RiWifiLine,
                handler: handleTestConnection
            },
            edit: {
                label: 'Edit',
                icon: RiEditLine,
                handler: handleEditConnection
            },
            delete: {
                handler: handleDeleteConnection,
                confirm: (item) => `Delete connection "${item.name}"? This action cannot be undone.`,
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
            render: (value) => formatRelativeDate(value),
            skeleton: { variant: 'text', width: 80 }
        }
    ], []);

    return (
        <>
            <DocumentListing<SSHConnection>
                key={refreshKey}
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
            />
            <SSHConnectionModal
                connection={editingConnection}
                mode={modalMode}
                onSuccess={handleModalSuccess}
            />
        </>
    );
};

export default SSHConnectionsPage;
