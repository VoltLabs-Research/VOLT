import { cn } from '@/shared/utils/cn';
import { formatSize } from '@/shared/utils/format';
import { Button, Row, Stack, Text, Tooltip } from '@/shared/presentation/primitives';
import './FileAttachment.css';
import { IoDocumentOutline, IoDownloadOutline, IoImageOutline } from 'react-icons/io5';
import { Copy } from 'lucide-react';
import { sileo } from 'sileo';

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

    const handleCopyName = async () => {
        try {
            await navigator.clipboard.writeText(fileName);
            sileo.success({ title: 'File name copied to clipboard' });
        } catch {
            sileo.error({ title: 'Failed to copy file name' });
        }
    };
    
    return (
        <Row gap='075' className={cn('file-attachment', `file-attachment--${variant}`, className)}>
            <div className={cn('d-flex flex-center f-shrink-0', showPreview && isImage ? 'file-attachment-preview' : 'file-attachment-icon')}>
                {showPreview && isImage && fileUrl ? (
                    <img
                        src={fileUrl}
                        alt={fileName}
                        className='w-max h-max radius-sm file-attachment-image'
                    />
                ) : isImage ? (
                    <IoImageOutline size={iconSize} className='color-muted' />
                ) : (
                    <IoDocumentOutline size={iconSize} className='color-muted' />
                )}
            </div>

            <Stack flex='1' overflow='hidden'>
                <Row gap='05' flex='1' overflow='hidden'>
                    <Text as='p' size='md' weight='medium' truncate className='file-attachment-name' title={fileName}>
                        {fileName}
                    </Text>
                    <Tooltip content='Copy full file name'>
                        <Button
                            variant='ghost'
                            intent='neutral'
                            size='sm'
                            iconOnly
                            aria-label={`Copy full name for ${fileName}`}
                            title='Copy full file name'
                            className='file-attachment-copy'
                            onClick={handleCopyName}
                        >
                            <Copy size={14} aria-hidden='true' />
                        </Button>
                    </Tooltip>
                </Row>
                <Row gap='05' className='font-size-1'>
                    {fileSize !== undefined && <p>{formatSize(fileSize)}</p>}
                    {timestamp && (
                        <>
                            {fileSize !== undefined && <p>-</p>}
                            <p>{timestamp}</p>
                        </>
                    )}
                </Row>
            </Stack>

            {showDownload && fileUrl && (
                <Tooltip content='Download'>
                    <a
                        href={fileUrl}
                        download={fileName}
                        className='d-flex flex-center file-attachment-download color-secondary'
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Download ${fileName}`}
                        title={`Download ${fileName}`}
                    >
                        <IoDownloadOutline size={18} aria-hidden='true' />
                    </a>
                </Tooltip>
            )}
        </Row>
    );
};

export default FileAttachment;
