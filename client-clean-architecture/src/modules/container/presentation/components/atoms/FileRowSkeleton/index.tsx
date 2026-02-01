import { Skeleton } from '@mui/material';
import Container from '@/shared/presentation/components/Container';

const FileRowSkeleton = () => (
    <Container className='container-file-item items-center'>
        <Skeleton variant='circular' width={20} height={20} />
        <Skeleton variant='text' width='60%' height={20} />
        <Skeleton variant='text' width={60} height={20} />
        <Skeleton variant='text' width={100} height={20} />
    </Container>
);

export default FileRowSkeleton;
