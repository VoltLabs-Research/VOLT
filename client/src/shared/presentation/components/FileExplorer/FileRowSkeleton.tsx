import Skeleton from '@/shared/presentation/primitives/Skeleton';
interface FileRowSkeletonProps {
    className?: string;
};

const FileRowSkeleton = ({ className = 'file-explorer-row' }: FileRowSkeletonProps) => (
    <div className={`${className}`}>
        <Skeleton variant='circular' width={18} height={18} />
        <Skeleton variant='text' width='60%' height={20} />
        <Skeleton variant='text' width={60} height={18} />
        <Skeleton variant='text' width={80} height={18} />
    </div>
);

export default FileRowSkeleton;
