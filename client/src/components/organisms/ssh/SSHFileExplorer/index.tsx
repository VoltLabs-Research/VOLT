import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSSHExplorerStore, useSSHConnectionStore, type SSHConnection } from '@/stores/slices/ssh';
import { useTeamStore } from '@/features/team/stores';
import FileExplorer from '@/features/trajectory/components/organisms/FileExplorer';
import SSHConnectionModal from '@/components/molecules/ssh/SSHConnectionModal';
import Draggable from '@/components/atoms/common/Draggable';
import WindowIcons from '@/components/molecules/common/WindowIcons';
import Container from '@/components/primitives/Container';
import Button from '@/components/primitives/Button';
import Tooltip from '@/components/atoms/common/Tooltip';
import { formatDistanceToNow } from 'date-fns';
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
import { formatSize } from '@/utilities/glb/scene-utils';
import useToast from '@/hooks/ui/use-toast';
import useConfirm from '@/hooks/ui/use-confirm';
import './SSHFileExplorer.css';

type SSHFileExplorerProps = {
    onClose?: () => void;
    onImportSuccess?: () => void;
};

const SSHFileExplorer = ({ onClose, onImportSuccess }: SSHFileExplorerProps) => {
    const [isMaximized, setIsMaximized] = useState(false);
    const [editingConnection, setEditingConnection] = useState<SSHConnection | null>(null);

    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    const { showSuccess, showError } = useToast();
    const { confirm } = useConfirm();

    const { connections, fetchConnections, deleteConnection } = useSSHConnectionStore();
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
    } = useSSHExplorerStore();

    const canBack = historyIndex > 0;
    const canForward = historyIndex < history.length - 1;

    useEffect(() => {
        fetchConnections();
    }, []);

    useEffect(() => {
        return () => reset();
    }, []);

    const handleConnectionSelect = async (conn: SSHConnection) => {
        setConnection(conn._id);
        try {
            await open('.');
        } catch (err: any) {
            showError(err.message || 'Failed to connect to SSH server');
        }
    };

    const handleImport = async () => {
        if (!selected || !selectedTeam) return;

        try {
            await importTrajectory(selectedTeam._id);
            showSuccess('Trajectory import started successfully');
            if (onImportSuccess) onImportSuccess();
        } catch (err: any) {
            showError(err.message || 'Failed to import trajectory');
        }
    };

    const handleDeleteConnection = async (conn: SSHConnection) => {
        const isConfirmed = await confirm(`Delete connection "${conn.name}"?`);
        if (!isConfirmed) return;

        try {
            await deleteConnection(conn._id);
            if (connectionId === conn._id) {
                reset();
            }
            showSuccess('Connection deleted successfully');
        } catch (err: any) {
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
                            <Tooltip content="Settings" placement="top">
                                <span>
                                    <LuSettings
                                        size={14}
                                        onClick={(e) => { e.stopPropagation(); openConnectionModal(conn); }}
                                        style={{ cursor: 'pointer' }}
                                    />
                                </span>
                            </Tooltip>
                            <Tooltip content="Delete" placement="top">
                                <span>
                                    <LuTrash
                                        size={14}
                                        onClick={(e) => { e.stopPropagation(); handleDeleteConnection(conn); }}
                                        style={{ cursor: 'pointer' }}
                                    />
                                </span>
                            </Tooltip>
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

    const headerLeftIcons = (
        <>
            <Tooltip content="Back" placement="bottom">
                <i className={`file-explorer-header-icon-container ${!canBack ? 'is-disabled' : ''}`} onClick={back}>
                    <LuArrowLeft size={20} />
                </i>
            </Tooltip>
            <Tooltip content="Forward" placement="bottom">
                <i className={`file-explorer-header-icon-container ${!canForward ? 'is-disabled' : ''}`} onClick={forward}>
                    <LuArrowRight size={20} />
                </i>
            </Tooltip>
            <Tooltip content="Go Up" placement="bottom">
                <i className={`file-explorer-header-icon-container ${(!cwd || cwd === '.') ? 'is-disabled' : ''}`} onClick={up}>
                    <LuArrowUp size={20} />
                </i>
            </Tooltip>
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
            <Tooltip content="Refresh" placement="bottom">
                <i className="file-explorer-header-icon-container" onClick={refresh}>
                    <LuRefreshCw size={20} />
                </i>
            </Tooltip>

            {selected && (
                <Tooltip content="Import Trajectory" placement="bottom">
                    <Button
                        variant='solid'
                        intent='brand'
                        size='sm'
                        onClick={handleImport}
                        disabled={importing}
                        isLoading={importing}
                        leftIcon={<LuDownload />}
                    >
                        Import
                    </Button>
                </Tooltip>
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
                        <div className="file-explorer-list-column" style={{ opacity: 0.7 }}>{entry.mtime ? formatDistanceToNow(new Date(entry.mtime).toISOString(), { addSuffix: true }) : '-'}</div>
                    </div>
                ))
            )}
        </>
    );

    return createPortal(
        <>
            <Draggable
                className='ssh-file-explorer-container primary-surface'
                enabled={!isMaximized}
                bounds='viewport'
                axis='both'
                doubleClickToDrag={true}
                handle='.ssh-file-explorer-title'
                scaleWhileDragging={0.95}
                resizable={true}
                minWidth={800}
                minHeight={500}
                style={{
                    width: isMaximized ? '100vw' : undefined,
                    height: isMaximized ? '100vh' : undefined,
                    top: isMaximized ? 0 : undefined,
                    left: isMaximized ? 0 : 'calc(50% - 500px)'
                }}
            >
                <Container className='d-flex column ssh-file-explorer-window-header'>
                    <WindowIcons
                        onClose={onClose}
                        onExpand={() => setIsMaximized(!isMaximized)}
                    />
                </Container>
                <FileExplorer
                    title="SSH Connections"
                    navItems={navItems}
                    headerLeftIcons={headerLeftIcons}
                    breadcrumbs={breadcrumbsContent}
                    headerRightIcons={headerRightIcons}
                    fileListHeader={fileListHeader}
                    fileListContent={fileListContent}
                />
            </Draggable>

            <SSHConnectionModal
                connection={editingConnection}
                mode={editingConnection ? 'edit' : 'create'}
            />
        </>,
        document.body
    );
};

export default SSHFileExplorer;
