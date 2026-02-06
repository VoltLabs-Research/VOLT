import { Skeleton } from '@mui/material';
import Container from '@/shared/presentation/components/Container';

interface FileRowSkeletonProps {
    className?: string;
}

const FileRowSkeleton: React.FC<FileRowSkeletonProps> = ({ className = 'file-explorer-row' }) => (
    <Container className={className}>
        <Skeleton variant='circular' width={18} height={18} />
        <Skeleton variant='text' width='60%' height={20} />
        <Skeleton variant='text' width={60} height={18} />
        <Skeleton variant='text' width={80} height={18} />
    </Container>
);

export default FileRowSkeleton;
