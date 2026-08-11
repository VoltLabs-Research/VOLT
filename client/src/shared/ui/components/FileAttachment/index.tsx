import { Button, Tooltip, cn } from '@heroui/react';
import { formatSize } from '@/shared/utils/format';
import { copyTextToClipboard } from '@/shared/ui/utils/copy-to-clipboard';
import { Copy, Download, FileText, Image } from 'lucide-react';

type FileAttachmentVariant = 'compact' | 'detailed';

const IMAGE_FILE_EXTENSIONS = new Set([
    'jpg',
    'jpeg',
    'png',
    'gif',
    'webp',
    'bmp',
    'svg',
    'avif',
    'heic',
    'heif'
]);

const getFileExtension = (value?: string): string => {
    if (!value) return '';
    const normalized = value.split('?')[0].toLowerCase();
    const dotIndex = normalized.lastIndexOf('.');
    return dotIndex === -1 ? '' : normalized.slice(dotIndex + 1);
};

const isImageAttachment = (fileType?: string, fileName?: string, fileUrl?: string): boolean => {
    if (fileType?.toLowerCase().startsWith('image/')) return true;

    const fileNameExtension = getFileExtension(fileName);
    if (IMAGE_FILE_EXTENSIONS.has(fileNameExtension)) return true;

    const urlExtension = getFileExtension(fileUrl);
    return IMAGE_FILE_EXTENSIONS.has(urlExtension);
};

interface FileAttachmentProps {
    fileName?: string;
    fileSize?: number;
    fileUrl?: string;
    fileType?: string;
    showDownload?: boolean;
    showPreview?: boolean;
    variant?: FileAttachmentVariant;
    timestamp?: string;
    className?: string;
};

const FileAttachment = ({
    fileName = 'File',
    fileSize,
    fileUrl,
    fileType,
    showDownload = true,
    showPreview = true,
    variant = 'compact',
    timestamp,
    className
}: FileAttachmentProps) => {
    const isImage = isImageAttachment(fileType, fileName, fileUrl);
    const iconSize = variant === 'compact' ? 18 : 20;
    const usePreviewTile = showPreview && isImage;

    const handleCopyName = () => {
        void copyTextToClipboard(fileName, {
            successMessage: 'File name copied to clipboard',
            errorMessage: 'Failed to copy file name'
        });
    };

    return (
        <div className={cn('group flex flex-row items-center gap-3 p-2 rounded-lg transition-colors duration-150 hover:bg-surface-hover', className)}>
            <div className={cn(
                'flex items-center justify-center shrink-0 rounded-lg',
                usePreviewTile
                    ? cn({ compact: 'size-12', detailed: 'size-14' }[variant], 'overflow-hidden')
                    : cn({ compact: 'size-10', detailed: 'size-12' }[variant], 'bg-surface-secondary')
            )}>
                {usePreviewTile && fileUrl ? (
                    <img
                        src={fileUrl}
                        alt={fileName}
                        className='w-full h-full rounded-lg object-cover'
                    />
                ) : isImage ? (
                    <Image size={iconSize} className='text-muted' />
                ) : (
                    <FileText size={iconSize} className='text-muted' />
                )}
            </div>

            <div className='flex flex-col overflow-hidden flex-1'>
                <div className='flex flex-row items-center gap-2 overflow-hidden flex-1'>
                    <p className='text-sm font-medium truncate' title={fileName}>
                        {fileName}
                    </p>
                    <Tooltip>
                        <Button
                            variant='ghost'
                            size='sm'
                            isIconOnly
                            aria-label={`Copy full name for ${fileName}`}
                            className='opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100'
                            onPress={handleCopyName}
                        >
                            <Copy size={14} aria-hidden='true' />
                        </Button>
                        <Tooltip.Content>Copy full file name</Tooltip.Content>
                    </Tooltip>
                </div>
                <div className='flex flex-row items-center gap-2 text-xs'>
                    {fileSize !== undefined && <p>{formatSize(fileSize)}</p>}
                    {timestamp && (
                        <>
                            {fileSize !== undefined && <p>-</p>}
                            <p>{timestamp}</p>
                        </>
                    )}
                </div>
            </div>

            {showDownload && fileUrl && (
                <a
                    href={fileUrl}
                    download={fileName}
                    className='flex items-center justify-center p-1.5 rounded-lg text-muted transition-colors duration-150 hover:bg-surface-hover'
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Download ${fileName}`}
                    title={`Download ${fileName}`}
                >
                    <Download size={18} aria-hidden='true' />
                </a>
            )}
        </div>
    );
};

export default FileAttachment;
