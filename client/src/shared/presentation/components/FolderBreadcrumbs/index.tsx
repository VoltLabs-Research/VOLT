import Container from '@/shared/presentation/components/Container';
import { ChevronRight } from 'lucide-react';
import type { FolderBreadcrumbItem } from '@/shared/presentation/hooks/use-folder-breadcrumbs';

interface FolderBreadcrumbsProps {
    items: FolderBreadcrumbItem[];
    onNavigate: (folderId: string | null) => void;
};

const FolderBreadcrumbs = ({ items, onNavigate }: FolderBreadcrumbsProps) => {
    return (
        <nav className='d-flex items-center gap-05 font-size-2'>
            {items.map((item, index) => {
                const isCurrent = index === items.length - 1;
                const className = isCurrent
                    ? 'color-primary font-weight-6'
                    : 'color-secondary cursor-pointer';

                return (
                    <Container key={item.id ?? 'root'} className='d-flex items-center gap-05'>
                        {index > 0 && <ChevronRight size={12} className='color-muted' />}
                        <span
                            className={className}
                            onClick={isCurrent ? undefined : () => onNavigate(item.id)}
                        >
                            {item.title}
                        </span>
                    </Container>
                );
            })}
        </nav>
    );
};

export default FolderBreadcrumbs;
