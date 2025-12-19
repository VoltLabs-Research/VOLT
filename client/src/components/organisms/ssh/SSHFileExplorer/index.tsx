import { useEffect, useState } from 'react';
import useSSHFileExplorer from '@/stores/ssh-file-explorer';
import useSSHConnections, { type SSHConnection } from '@/stores/ssh-connections';
import useTeamStore from '@/stores/team/team';
import FileExplorerWindow from '@/components/organisms/trajectory/FileExplorerWindow';
import SSHConnectionModal from '@/components/molecules/ssh/SSHConnectionModal';
import Button from '@/components/primitives/Button';
import formatTimeAgo from '@/utilities/formatTimeAgo';
import {
    LuFolder,
    LuFile,
    LuRefreshCw,
    LuArrowLeft,
    LuArrowRight,
    LuArrowUp,
    LuDownload,
    LuPlus,
    LuSettings,
    LuTrash
} from 'react-icons/lu';
import { TbServer } from 'react-icons/tb';
import { CircularProgress } from '@mui/material';
import { formatSize } from '@/utilities/scene-utils';
import useToast from '@/hooks/ui/use-toast';

type SSHFileExplorerProps = {
    onClose?: () => void;
    onImportSuccess?: () => void;
};

const SSHFileExplorer = ({ onClose, onImportSuccess }: SSHFileExplorerProps) => {
    const [isMaximized, setIsMaximized] = useState(false);
    const [editingConnection, setEditingConnection] = useState<SSHConnection | null>(null);

    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    const { showSuccess, showError } = useToast();

    const { connections, fetchConnections, deleteConnection } = useSSHConnections();
    const {
        connectionId,
        cwd,
        entries,
        breadcrumbs,
        selected,
        loading,
        importing,
        error,
        historyIndex,
        history,
        setConnection,
        open,
        enter,
        up,
        back,
        forward,
        refresh,
        select,
        importTrajectory,
        reset
    } = useSSHFileExplorer();

    const canBack = historyIndex > 0;
    const canForward = historyIndex < history.length - 1;

    useEffect(() => {
        fetchConnections();
    }, []);

    useEffect(() => {
        return () => reset();
    }, []);

    const handleConnectionSelect = async(conn: SSHConnection) => {
        setConnection(conn._id);
        try{
            await open('.');
        }catch(err: any){
            showError(err.message || 'Failed to connect to SSH server');
        }
    };

    const handleImport = async() => {
        if(!selected || !selectedTeam) return;

        try{
            await importTrajectory(selectedTeam._id);
            showSuccess('Trajectory import started successfully');
            if(onImportSuccess) onImportSuccess();
            if(onClose) onClose();
        }catch(err: any){
            showError(err.message || 'Failed to import trajectory');
        }
    };

    const handleDeleteConnection = async(conn: SSHConnection) => {
        if(!confirm(`Delete connection "${conn.name}"?`)) return;

        try{
            await deleteConnection(conn._id);
            if(connectionId === conn._id){
                reset();
            }
            showSuccess('Connection deleted successfully');
        }catch(err: any){
            showError(err.message || 'Failed to delete connection');
        }
    };

    const openConnectionModal = (connection: SSHConnection | null = null) => {
        setEditingConnection(connection);
        // Small timeout to allow React to update props before showing modal
        setTimeout(() => {
            (document.getElementById('ssh-connection-modal') as HTMLDialogElement)?.showModal();
        }, 0);
    };

    const navItems = (
        <>
            <div className="d-flex column gap-025 ssh-connections-list">
                {connections.map((conn) => (
                    <div
                        key={conn._id}
                        className={`d-flex items-center content-between pointer file-explorer-nav-item ${connectionId === conn._id ? 'active' : ''}`}
                        onClick={() => handleConnectionSelect(conn)}
                    >
                        <div className="d-flex items-center gap-05 file-explorer-list-name-container">
                            <TbServer className="file-explorer-icon" />
                            <span className="file-explorer-nav-item-title font-weight-4">{conn.name}</span>
                        </div>
                        <div className="d-flex gap-025 ssh-connection-actions" style={{ opacity: 0.5 }}>
                            <LuSettings
                                size={14}
                                onClick={(e) => { e.stopPropagation(); openConnectionModal(conn); }}
                                style={{ cursor: 'pointer' }}
                            />
                            <LuTrash
                                size={14}
                                onClick={(e) => { e.stopPropagation(); handleDeleteConnection(conn); }}
                                style={{ cursor: 'pointer' }}
                            />
                        </div>
                    </div>
                ))}
            </div>
            <Button
                variant='soft'
                intent='neutral'
                size='sm'
                block
                leftIcon={<LuPlus />}
                onClick={() => openConnectionModal(null)}
                style={{ marginTop: '1rem' }}
            >
                Add Connection
            </Button>
        </>
    );

    // ... existing content(headerLeftIcons, breadcrumbsContent, headerRightIcons, fileListHeader, fileListContent, return statement) ...
    // Note: I will only replace the parts that need changing.
    // Wait, replace_file_content replaces a block usually.
    // I should target the navItems block and the return statement separately? Or the whole file is too big.
    // I will do separate edits.

    // This replacement handles the navItems definition update.

    const headerLeftIcons = (
        <>
            <i className={`file-explorer-header-icon-container ${!canBack ? 'is-disabled' : ''}`} onClick={back}>
                <LuArrowLeft size={20} />
            </i>
            <i className={`file-explorer-header-icon-container ${!canForward ? 'is-disabled' : ''}`} onClick={forward}>
                <LuArrowRight size={20} />
            </i>
            <i className={`file-explorer-header-icon-container ${(!cwd || cwd === '.') ? 'is-disabled' : ''}`} onClick={up}>
                <LuArrowUp size={20} />
            </i>
        </>
    );

    const breadcrumbsContent = breadcrumbs.map((b, i) => (
        <div key={i} className="d-flex items-center search-breadcrumb-container">
            <span
                className="search-breadcrumb-name"
                onClick={() => open(b.relPath)}
                style={{ cursor: 'pointer', color: i === breadcrumbs.length - 1 ? 'white' : 'rgba(255,255,255,0.7)' }}
            >
                {b.name}
            </span>
        </div>
    ));

    const headerRightIcons = (
        <>
            <i className="file-explorer-header-icon-container" onClick={refresh} title="Refresh">
                <LuRefreshCw size={20} />
            </i>

            {selected && (
                <Button
                    variant='solid'
                    intent='brand'
                    size='sm'
                    onClick={handleImport}
                    title="Import Trajectory"
                    disabled={importing}
                    isLoading={importing}
                    leftIcon={<LuDownload />}
                >
                    Import
                </Button>
            )}
        </>
    );

    const fileListHeader = (
        <>
            <div className="file-explorer-list-column">Name</div>
            <div className="file-explorer-list-column">Type</div>
            <div className="file-explorer-list-column">Size</div>
            <div className="file-explorer-list-column">Modified</div>
        </>
    );

    const fileListContent = (
        <>
            {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
                    <CircularProgress size={24} />
                    <p>Loading files...</p>
                </div>
            ) : error ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#ff6b6b' }}>
                    <p>{error}</p>
                    <Button variant='soft' intent='neutral' size='sm' onClick={refresh} style={{ marginTop: '1rem' }}>Retry</Button>
                </div>
            ) : entries.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
                    <p>No files found</p>
                </div>
            ) : (
                entries.map((entry) => (
                    <div
                        key={entry.name}
                        className={`file-explorer-list-row ${selected === entry.relPath ? 'selected' : ''} items-center`}
                        onClick={() => select(entry.relPath)}
                        onDoubleClick={() => entry.type === 'dir' ? enter(entry.name) : null}
                    >
                        <div className="d-flex items-center gap-05 file-explorer-list-column file-explorer-list-name-container">
                            <span className="file-explorer-file-icon-container">
                                {entry.type === 'dir' ? <LuFolder /> : <LuFile />}
                            </span>
                            <span className="file-explorer-file-name">{entry.name}</span>
                        </div>
                        <div className="file-explorer-list-column" style={{ opacity: 0.7 }}>{entry.type === 'dir' ? 'Folder' : 'File'}</div>
                        <div className="file-explorer-list-column" style={{ opacity: 0.7 }}>{entry.size !== undefined ? formatSize(entry.size) : '-'}</div>
                        <div className="file-explorer-list-column" style={{ opacity: 0.7 }}>{entry.mtime ? formatTimeAgo(new Date(entry.mtime).toISOString()) : '-'}</div>
                    </div>
                ))
            )}
        </>
    );

    return (
        <>
            <FileExplorerWindow
                title="SSH Connections"
                isMaximized={isMaximized}
                setIsMaximized={setIsMaximized}
                onClose={onClose}
                navItems={navItems}
                headerLeftIcons={headerLeftIcons}
                breadcrumbs={breadcrumbsContent}
                headerRightIcons={headerRightIcons}
                fileListHeader={fileListHeader}
                fileListContent={fileListContent}
                hidden={false}
            />

            <SSHConnectionModal
                connection={editingConnection}
                mode={editingConnection ? 'edit' : 'create'}
            />
        </>
    );
};

export default SSHFileExplorer;
