import './FolderBreadcrumbs.css';
import { ChevronRight } from 'lucide-react';
import type { FolderBreadcrumbItem } from '@/shared/presentation/hooks/use-folder-breadcrumbs';

interface FolderBreadcrumbsProps {
    items: FolderBreadcrumbItem[];
    onNavigate: (folderId: string | null) => void;
};

const FolderBreadcrumbs = ({ items, onNavigate }: FolderBreadcrumbsProps) => {
    return (
        <nav className='folder-breadcrumbs d-flex items-center font-size-2' aria-label='Folder breadcrumbs'>
            <ol className='folder-breadcrumbs__list'>
                {items.map((item, index) => {
                    const isCurrent = index === items.length - 1;

                    return (
                        <li key={item.id ?? 'root'} className='folder-breadcrumbs__item'>
                            {index > 0 && <ChevronRight size={12} className='folder-breadcrumbs__separator' aria-hidden='true' />}
                            {isCurrent ? (
                                <span className='folder-breadcrumbs__current' aria-current='page'>
                                    {item.title}
                                </span>
                            ) : (
                                <button
                                    type='button'
                                    className='folder-breadcrumbs__link'
                                    onClick={() => onNavigate(item.id)}
                                >
                                    {item.title}
                                </button>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
};

export default FolderBreadcrumbs;
