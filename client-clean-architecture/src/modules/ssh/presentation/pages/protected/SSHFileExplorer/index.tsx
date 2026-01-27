import { useEffect } from 'react';
import { usePageTitle } from '@/shared/presentation/hooks/core/use-page-title';
import { useParams, useNavigate } from 'react-router-dom';
import { useTeamStore } from '@/modules/team/presentation/stores';
import FileExplorer from '@/shared/presentation/components/organisms/common/FileExplorer';
import { FileRowSkeleton, BreadcrumbsSkeleton } from '@/shared/presentation/components/organisms/common/FileExplorer/Skeletons';
import Button from '@/shared/presentation/components/primitives/Button';
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
import useToast from '@/shared/presentation/hooks/ui/use-toast';
import { useSSHStore } from '../../../stores';

const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const SSHFileExplorerPage = () => {
    usePageTitle('SSH File Explorer');
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
        openExplorer,
        enterExplorer,
        upExplorer,
        backExplorer,
        forwardExplorer,
        refreshExplorer,
        selectExplorer,
        importTrajectoryFromSSH,
        resetExplorer
    } = useSSHStore();

    const canBack = historyIndex > 0;
    const canForward = historyIndex < history.length - 1;

    useEffect(() => {
        if (!connectionId) {
            navigate('/dashboard/ssh-connections');
            return;
        }

        setConnection(connectionId);
        openExplorer('.').catch((err: any) => {
            showError(err.message || 'Failed to connect to SSH server');
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connectionId]);

    useEffect(() => {
        return () => resetExplorer();
    }, [resetExplorer]);

    const handleImport = async () => {
        if (!selected) return;

        if (!selectedTeam) {
            showError('Please select a team first');
            return;
        }

        try {
            await importTrajectoryFromSSH(selectedTeam._id);
            showSuccess('Trajectory import started successfully');
        } catch (err: any) {
            showError(err.message || 'Failed to import trajectory');
        }
    };

    const headerLeftIcons = (
        <>
            <i className={`file-explorer-header-icon-container ${!canBack ? 'is-disabled' : ''}`} onClick={backExplorer}>
                <LuArrowLeft size={20} />
            </i>
            <i className={`file-explorer-header-icon-container ${!canForward ? 'is-disabled' : ''}`} onClick={forwardExplorer}>
                <LuArrowRight size={20} />
            </i>
            <i className={`file-explorer-header-icon-container ${(!cwd || cwd === '.') ? 'is-disabled' : ''}`} onClick={upExplorer}>
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
                    onClick={() => openExplorer(b.relPath)}
                    style={{ cursor: 'pointer', color: i === breadcrumbs.length - 1 ? 'white' : 'rgba(255,255,255,0.7)' }}
                >
                    {b.name}
                </span>
            </div>
        ))
    );

    const headerRightIcons = (
        <>
            <i className="file-explorer-header-icon-container" onClick={refreshExplorer} title="Refresh">
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
                    <Button variant='soft' intent='neutral' size='sm' onClick={refreshExplorer} style={{ marginTop: '1rem' }}>Retry</Button>
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
                        onClick={() => selectExplorer(entry.relPath)}
                        onDoubleClick={() => entry.type === 'dir' ? enterExplorer(entry.name) : null}
                    >
                        <div className="d-flex items-center gap-05 file-explorer-list-column file-explorer-list-name-container">
                            <span className="file-explorer-file-icon-container">
                                {entry.type === 'dir' ? <LuFolder /> : <LuFile />}
                            </span>
                            <span className="file-explorer-file-name">{entry.name}</span>
                        </div>
                        <div className="file-explorer-list-column" style={{ opacity: 0.7 }}>{entry.type === 'dir' ? 'Folder' : 'File'}</div>
                        <div className="file-explorer-list-column" style={{ opacity: 0.7 }}>{entry.size !== undefined ? formatSize(entry.size) : '-'}</div>
                        <div className="file-explorer-list-column" style={{ opacity: 0.7 }}>{entry.mtime ? formatDistanceToNow(new Date(entry.mtime), { addSuffix: true }) : '-'}</div>
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

export default SSHFileExplorerPage;
