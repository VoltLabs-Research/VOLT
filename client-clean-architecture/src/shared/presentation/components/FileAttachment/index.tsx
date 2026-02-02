import { IoDocumentOutline, IoDownloadOutline, IoImageOutline } from 'react-icons/io5';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Tooltip from '@/shared/presentation/components/Tooltip';
import { formatSize } from '@/shared/utils/format';
import { cn } from '@/shared/utils/cn';
import './FileAttachment.css';

type FileAttachmentVariant = 'compact' | 'detailed';

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
}

const FileAttachment = ({
    fileName = 'File',
    fileSize,
    fileUrl,
    fileType,
    showDownload = true,
    showPreview = false,
    variant = 'compact',
    timestamp,
    className
}: FileAttachmentProps) => {
    const isImage = fileType?.startsWith('image/');
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
                <Paragraph className='font-size-2 font-weight-5 file-attachment-name'>
                    {fileName}
                </Paragraph>
                <Container className='d-flex items-center gap-05 font-size-1 color-muted'>
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
                        className='d-flex flex-center file-attachment-download color-secondary'
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
