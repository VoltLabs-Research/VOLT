import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSSHExplorerStore } from '@/stores/slices/ssh';
import { useTeamStore } from '@/stores/slices/team';
import FileExplorer from '@/components/organisms/trajectory/FileExplorer';
import Button from '@/components/primitives/Button';
import { formatDistanceToNow } from 'date-fns';
import {
    LuFolder,
    LuFile,
    LuRefreshCw,
    LuArrowLeft,
    LuArrowRight,
    LuArrowUp,
    LuDownload
} from 'react-icons/lu';
import { formatSize } from '@/utilities/glb/scene-utils';
import useToast from '@/hooks/ui/use-toast';
import { FileRowSkeleton, BreadcrumbsSkeleton } from '@/components/organisms/trajectory/FileExplorer/Skeletons';

const SSHFileExplorer = () => {
    const { connectionId } = useParams<{ connectionId: string }>();
    const navigate = useNavigate();
    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    const { showSuccess, showError } = useToast();

    const {
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
        if (!connectionId) {
            navigate('/dashboard/ssh-connections');
            return;
        }

        setConnection(connectionId);
        open('.').catch((err: any) => {
            showError(err.message || 'Failed to connect to SSH server');
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connectionId]);

    useEffect(() => {
        return () => reset();
    }, []);

    const handleImport = async () => {
        if (!selected) return;

        if (!selectedTeam) {
            showError('Please select a team first');
            return;
        }

        try {
            await importTrajectory(selectedTeam._id);
            showSuccess('Trajectory import started successfully');
        } catch (err: any) {
            showError(err.message || 'Failed to import trajectory');
        }
    };

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

    const breadcrumbsContent = loading && breadcrumbs.length <= 1 ? (
        <BreadcrumbsSkeleton />
    ) : (
        breadcrumbs.map((b, i) => (
            <div key={i} className="d-flex items-center search-breadcrumb-container">
                <span
                    className="search-breadcrumb-name"
                    onClick={() => open(b.relPath)}
                    style={{ cursor: 'pointer', color: i === breadcrumbs.length - 1 ? 'white' : 'rgba(255,255,255,0.7)' }}
                >
                    {b.name}
                </span>
            </div>
        ))
    );

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
                Array.from({ length: 15 }).map((_, i) => <FileRowSkeleton key={`s-${i}`} />)
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

    return (
        <FileExplorer
            title="SSH File Explorer"
            headerLeftIcons={headerLeftIcons}
            breadcrumbs={breadcrumbsContent}
            headerRightIcons={headerRightIcons}
            fileListHeader={fileListHeader}
            fileListContent={fileListContent}
        />
    );
};

export default SSHFileExplorer;