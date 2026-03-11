import useLatexAssets from '@/modules/latex/hooks/use-latex-assets';
import Container from '@/shared/presentation/components/Container';
import FileExplorer from '@/shared/presentation/components/FileExplorer';
import IconButton from '@/shared/presentation/components/IconButton';
import PanelHeader from '@/shared/presentation/components/PanelHeader';
import { formatSize } from '@/shared/utils/format';
import { cn } from '@/shared/utils';
import { FileText, FolderOpen, Image, File, Paperclip, Trash2, Upload, Link } from 'lucide-react';
import type { LatexFileEntry } from '@/modules/latex/hooks/use-latex-workspace';
import type { LatexAsset } from '@/modules/latex/api/entities/latex-asset';

interface LatexFilePanelProps {
    documentId: string;
    files: LatexFileEntry[];
    onInsertRef: (ref: string) => void;
};

const FILE_ICON = <FileText size={14} />;
const FOLDER_ICON = <FolderOpen size={14} />;

const getAssetIcon = (mimetype: string) => {
    if (mimetype.startsWith('image/')) return <Image size={14} />;
    return <File size={14} />;
};

const renderFileRow = (file: LatexFileEntry) => (
    <Container
        key={file.name}
        className={cn('latex-workspace__file-row d-flex items-center gap-05', file.isSelected && 'is-selected')}
    >
        <span className='color-muted d-flex items-center'>{FILE_ICON}</span>
        <span className='latex-workspace__file-name'>{file.name}</span>
    </Container>
);

interface AssetRowProps {
    asset: LatexAsset;
    onDelete: (asset: LatexAsset) => void;
    onInsertRef: (asset: LatexAsset) => void;
};

const AssetRow = ({ asset, onDelete, onInsertRef }: AssetRowProps) => {
    const mimeShort = asset.mimetype.split('/')[1] ?? asset.mimetype;

    return (
        <Container className='latex-workspace__asset-row d-flex items-center content-between gap-05'>
            <Container className='d-flex items-center gap-05 flex-1 min-w-0'>
                <span className='color-muted d-flex items-center f-shrink-0'>
                    {getAssetIcon(asset.mimetype)}
                </span>
                <span className='latex-workspace__file-name text-truncate' title={asset.originalName}>
                    {asset.originalName}
                </span>
            </Container>
            <Container className='d-flex items-center gap-025 f-shrink-0'>
                <span className='latex-workspace__asset-meta color-muted'>{formatSize(asset.size)}</span>
                <span className='latex-workspace__asset-meta color-muted'>{mimeShort}</span>
                <IconButton
                    variant='ghost'
                    size='sm'
                    title='Insert reference in editor'
                    onClick={() => onInsertRef(asset)}
                >
                    <Link size={12} />
                </IconButton>
                <IconButton
                    variant='ghost'
                    size='sm'
                    title='Delete asset'
                    onClick={() => onDelete(asset)}
                >
                    <Trash2 size={12} />
                </IconButton>
            </Container>
        </Container>
    );
};

const LatexFilePanel = ({ documentId, files, onInsertRef }: LatexFilePanelProps) => {
    const {
        assets,
        isLoadingAssets,
        isUploading,
        fileInputRef,
        handleUploadClick,
        handleFileSelected,
        handleDeleteAsset,
        handleInsertRef
    } = useLatexAssets({ documentId, onInsertRef });

    const folderIcon = <span className='d-flex items-center color-muted'>{FOLDER_ICON}</span>;

    const uploadAction = (
        <IconButton
            variant='ghost'
            size='sm'
            title='Upload asset'
            disabled={isUploading}
            onClick={handleUploadClick}
        >
            <Upload size={14} />
        </IconButton>
    );

    const renderAssetRow = (asset: LatexAsset) => (
        <AssetRow
            key={asset._id}
            asset={asset}
            onDelete={handleDeleteAsset}
            onInsertRef={handleInsertRef}
        />
    );

    return (
        <Container className='latex-workspace__files d-flex column'>
            <PanelHeader
                variant='compact'
                icon={folderIcon}
                title='Files'
                actions={uploadAction}
            />

            <input
                ref={fileInputRef}
                type='file'
                className='d-none'
                onChange={handleFileSelected}
                accept='image/*,.pdf,.bib,.cls,.sty,.tex'
            />

            <FileExplorer isEmpty={files.length === 0} emptyMessage='No files'>
                {files.map(renderFileRow)}
            </FileExplorer>

            <Container className='latex-workspace__assets-section d-flex column'>
                <Container className='latex-workspace__assets-header d-flex items-center content-between'>
                    <Container className='d-flex items-center gap-05'>
                        <Paperclip size={12} />
                        <span className='font-size-05 color-muted'>Assets</span>
                    </Container>
                    <span className='font-size-05 color-muted'>{assets.length}</span>
                </Container>
                <FileExplorer
                    isEmpty={assets.length === 0}
                    isLoading={isLoadingAssets}
                    emptyMessage='No assets - upload figures or files'
                >
                    {assets.map(renderAssetRow)}
                </FileExplorer>
            </Container>
        </Container>
    );
};

export default LatexFilePanel;
