import { useParams } from 'react-router-dom';
import { LuFolder, LuFile } from 'react-icons/lu';
import { formatDistanceToNow } from 'date-fns';
import useSSHFileExplorer from '@/modules/ssh/presentation/hooks/use-ssh-file-explorer';
import FileExplorer from '@/shared/presentation/components/FileExplorer';
import FileExplorerRow from '@/shared/presentation/components/FileExplorer/FileExplorerRow';
import SSHExplorerHeaderLeft from '@/modules/ssh/presentation/components/atoms/SSHExplorerHeaderLeft';
import SSHExplorerHeaderRight from '@/modules/ssh/presentation/components/atoms/SSHExplorerHeaderRight';
import SSHBreadcrumbs from '@/modules/ssh/presentation/components/atoms/SSHBreadcrumbs';
import AccessDenied from '@/shared/presentation/components/AccessDenied';
import { formatSize } from '@/shared/utils/format';
import type { SSHFileEntry } from '@/modules/ssh/domain/entities';

interface SSHFileExplorerPageProps {
    connectionId?: string;
};

const SSHFileExplorerPage = ({ connectionId: propConnectionId }: SSHFileExplorerPageProps) => {
    const params = useParams<{ connectionId: string }>();
    const connectionId = propConnectionId || params.connectionId;

    const {
        connection,
        entries,
        cwd,
        isLoading,
        error,
        accessDenied,
        accessDeniedMessage,
        selectedPath,
        setSelectedPath,
        navigateTo,
        goUp,
        goBack,
        refresh
    } = useSSHFileExplorer({ connectionId });

    if(accessDenied){
        return <AccessDenied description={accessDeniedMessage} />;
    }

    const handleEntryClick = (entry: SSHFileEntry) => {
        setSelectedPath(entry.relPath);
    };

    const handleEntryDoubleClick = (entry: SSHFileEntry) => {
        if (entry.type === 'dir') {
            navigateTo(entry.relPath);
        }
    };

    const columns = (
        <>
            <span>Name</span>
            <span>Type</span>
            <span>Size</span>
            <span>Modified</span>
        </>
    );

    return (
        <FileExplorer
            headerLeft={
                <SSHExplorerHeaderLeft
                    connectionName={connection?.name}
                    cwd={cwd}
                    onBack={goBack}
                    onGoUp={goUp}
                />
            }
            breadcrumb={<SSHBreadcrumbs cwd={cwd} onNavigate={navigateTo} />}
            headerRight={<SSHExplorerHeaderRight onRefresh={refresh} />}
            columns={columns}
            isLoading={isLoading}
            isEmpty={entries.length === 0}
            error={error}
            emptyMessage='No files found in this directory'
        >
            {entries.map((entry) => (
                <FileExplorerRow
                    key={entry.name}
                    icon={entry.type === 'dir' ? <LuFolder /> : <LuFile />}
                    name={entry.name}
                    type={entry.type === 'dir' ? 'Folder' : 'File'}
                    size={entry.size !== undefined ? formatSize(entry.size) : undefined}
                    date={entry.mtime ? formatDistanceToNow(new Date(entry.mtime), { addSuffix: true }) : undefined}
                    isSelected={selectedPath === entry.relPath}
                    onClick={() => handleEntryClick(entry)}
                    onDoubleClick={() => handleEntryDoubleClick(entry)}
                />
            ))}
        </FileExplorer>
    );
};

export default SSHFileExplorerPage;
