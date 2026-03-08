import { cn } from '@/shared/utils/cn';
import { formatSize } from '@/shared/utils/format';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Tooltip from '@/shared/presentation/components/Tooltip';
import './FileAttachment.css';
import { IoDocumentOutline, IoDownloadOutline, IoImageOutline } from 'react-icons/io5';

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
    
    return (
        <Container className={cn('d-flex items-center gap-075 file-attachment', `file-attachment--${variant}`, className)}>
            <Container className={cn('d-flex flex-center f-shrink-0', showPreview && isImage ? 'file-attachment-preview' : 'file-attachment-icon')}>
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
            </Container>
            
            <Container className='d-flex column flex-1 overflow-hidden'>
                <Paragraph className='font-size-2 font-weight-5 file-attachment-name text-truncate'>
                    {fileName}
                </Paragraph>
                <Container className='d-flex items-center gap-05 font-size-1'>
                    {fileSize !== undefined && <Paragraph>{formatSize(fileSize)}</Paragraph>}
                    {timestamp && (
                        <>
                            {fileSize !== undefined && <Paragraph>-</Paragraph>}
                            <Paragraph>{timestamp}</Paragraph>
                        </>
                    )}
                </Container>
            </Container>
            
            {showDownload && fileUrl && (
                <Tooltip content='Download'>
                    <a
                        href={fileUrl}
                        download={fileName}
                        className='d-flex flex-center file-attachment-download color-'
                        onClick={(e) => e.stopPropagation()}
                    >
                        <IoDownloadOutline size={18} />
                    </a>
                </Tooltip>
            )}
        </Container>
    );
};

export default FileAttachment;
