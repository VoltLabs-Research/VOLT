import { useEffect, useState } from 'react';
import useSSHFileExplorer from '@/stores/ssh-file-explorer';
import useSSHConnections, { type SSHConnection } from '@/stores/ssh-connections';
import useTeamStore from '@/stores/team/team';
import FileExplorerWindow from '@/components/organisms/trajectory/FileExplorerWindow';
import SSHConnectionModal from '@/components/molecules/ssh/SSHConnectionModal';
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
    const [showConnectionModal, setShowConnectionModal] = useState(false);
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
        return() => reset();
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

    const navItems = (
        <>
            <div className="ssh-connections-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {connections.map((conn) => (
                    <div
                        key={conn._id}
                        className={`file-explorer-nav-item ${connectionId === conn._id ? 'active' : ''}`}
                        onClick={() => handleConnectionSelect(conn)}
                        style={{ justifyContent: 'space-between', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                    >
                        <div className="file-explorer-list-name-container">
                            <TbServer className="file-explorer-icon" />
                            <span className="file-explorer-nav-item-title">{conn.name}</span>
                        </div>
                        <div className="ssh-connection-actions" style={{ display: 'flex', gap: '0.25rem', opacity: 0.5 }}>
                            <LuSettings
                                size={14}
                                onClick={(e) => { e.stopPropagation(); setEditingConnection(conn); setShowConnectionModal(true); }}
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
            <button
                className="ssh-add-btn"
                onClick={() => { setEditingConnection(null); setShowConnectionModal(true); }}
                style={{
                    marginTop: '1rem',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    color: 'white',
                    padding: '0.5rem',
                    borderRadius: '0.25rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    fontSize: '0.85rem'
                }}
            >
                <LuPlus /> Add Connection
            </button>
        </>
    );

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
        <div key={i} className="search-breadcrumb-container">
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
                <button
                    onClick={handleImport}
                    className="breadcrumb-btn"
                    title="Import Trajectory"
                    disabled={importing}
                    style={{ background: 'var(--accent-blue)', color: 'white', padding: '0.25rem 0.75rem', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                    {importing ? <CircularProgress size={14} color="inherit" /> : <LuDownload />}
                    <span style={{ marginLeft: '0.5rem' }}>Import</span>
                </button>
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
                    <button onClick={refresh} style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>Retry</button>
                </div>
            ) : entries.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
                    <p>No files found</p>
                </div>
            ) : (
                entries.map((entry) => (
                    <div
                        key={entry.name}
                        className={`file-explorer-list-row ${selected === entry.relPath ? 'selected' : ''}`}
                        onClick={() => select(entry.relPath)}
                        onDoubleClick={() => entry.type === 'dir' ? enter(entry.name) : null}
                    >
                        <div className="file-explorer-list-column file-explorer-list-name-container">
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

    return(
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
                hidden={showConnectionModal}
            />

            {showConnectionModal && (
                <SSHConnectionModal
                    isOpen={showConnectionModal}
                    onClose={() => {
                        setShowConnectionModal(false);
                        setEditingConnection(null);
                    }}
                    connection={editingConnection}
                    mode={editingConnection ? 'edit' : 'create'}
                />
            )}
        </>
    );
};

export default SSHFileExplorer;
