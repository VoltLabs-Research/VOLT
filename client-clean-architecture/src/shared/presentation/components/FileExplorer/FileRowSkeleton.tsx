import { Skeleton } from '@mui/material';
import Container from '@/shared/presentation/components/Container';

const FileRowSkeleton = () => (
    <Container className='file-explorer-row'>
        <Container className='file-explorer-row-name'>
            <Skeleton variant='circular' width={18} height={18} />
            <Skeleton variant='text' width='60%' height={20} />
        </Container>
        <Skeleton variant='text' width={50} height={18} />
        <Skeleton variant='text' width={60} height={18} />
        <Skeleton variant='text' width={80} height={18} />
    </Container>
);

export default FileRowSkeleton;
