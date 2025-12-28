import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DocumentListing, { type ColumnConfig } from '@/components/organisms/common/DocumentListing';
import { useSSHConnectionStore, type SSHConnection } from '@/stores/slices/ssh';
import SSHConnectionModal from '@/components/molecules/ssh/SSHConnectionModal';
import useToast from '@/hooks/ui/use-toast';
import formatTimeAgo from '@/utilities/api/formatTimeAgo';
import { useState } from 'react';
import { RiDeleteBin6Line, RiSettings3Line, RiWifiLine } from 'react-icons/ri';
import { LuFolderOpen } from 'react-icons/lu';

const columns: ColumnConfig[] = [
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
        render: (value: string) => formatTimeAgo(value),
        skeleton: { variant: 'text', width: 80 }
    }
];

const SSHConnectionsListing = () => {
    const navigate = useNavigate();
    const { showSuccess, showError } = useToast();
    const [editingConnection, setEditingConnection] = useState<SSHConnection | null>(null);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');

    const { connections, loading, fetchConnections, deleteConnection, testConnection } = useSSHConnectionStore();

    useEffect(() => {
        fetchConnections();
    }, [fetchConnections]);

    const handleOpenFileExplorer = useCallback((connection: SSHConnection) => {
        navigate(`/dashboard/ssh-connections/${connection._id}/file-explorer`);
    }, [navigate]);

    const handleTestConnection = useCallback(async (connection: SSHConnection) => {
        const result = await testConnection(connection._id);
        if (result.valid) {
            showSuccess(`Connection to "${connection.name}" successful!`);
        } else {
            showError(result.error || `Connection to "${connection.name}" failed`);
        }
    }, [testConnection, showSuccess, showError]);

    const handleEditConnection = useCallback((connection: SSHConnection) => {
        setEditingConnection(connection);
        setModalMode('edit');
        setTimeout(() => {
            (document.getElementById('ssh-connection-modal') as HTMLDialogElement)?.showModal();
        }, 0);
    }, []);

    const handleDeleteConnection = useCallback(async (connection: SSHConnection) => {
        if (!window.confirm(`Delete connection "${connection.name}"? This cannot be undone.`)) return;

        try {
            await deleteConnection(connection._id);
            showSuccess(`Connection "${connection.name}" deleted`);
        } catch (err: any) {
            showError(err.message || 'Failed to delete connection');
        }
    }, [deleteConnection, showSuccess, showError]);

    const handleCreateNew = useCallback(() => {
        setEditingConnection(null);
        setModalMode('create');
        setTimeout(() => {
            (document.getElementById('ssh-connection-modal') as HTMLDialogElement)?.showModal();
        }, 0);
    }, []);

    const getMenuOptions = useCallback((item: SSHConnection) => [
        [
            'File Explorer',
            LuFolderOpen,
            () => handleOpenFileExplorer(item)
        ],
        [
            'Test Connection',
            RiWifiLine,
            () => handleTestConnection(item)
        ],
        [
            'Edit',
            RiSettings3Line,
            () => handleEditConnection(item)
        ],
        [
            'Delete',
            RiDeleteBin6Line,
            () => handleDeleteConnection(item)
        ]
    ], [handleOpenFileExplorer, handleTestConnection, handleEditConnection, handleDeleteConnection]);

    return (
        <>
            <DocumentListing
                title="SSH Connections"
                columns={columns}
                data={connections}
                isLoading={loading}
                emptyMessage="No SSH connections found. Create one to get started."
                getMenuOptions={getMenuOptions}
                createNew={{
                    buttonTitle: 'Add Connection',
                    onCreate: handleCreateNew
                }}
            />
            <SSHConnectionModal
                connection={editingConnection}
                mode={modalMode}
            />
        </>
    );
};

export default SSHConnectionsListing;
