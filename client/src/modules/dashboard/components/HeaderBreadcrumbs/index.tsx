import './HeaderBreadcrumbs.css';
import { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
interface BreadcrumbItem {
    label: string;
    path?: string;
    isCurrent?: boolean;
}

const HeaderBreadcrumbs = () => {
    const { pathname } = useLocation();

    const breadcrumbs = useMemo(() => {
        const segments = pathname.split('/').filter(Boolean).slice(1);

        if (segments.length > 2) {
            const firstSegment = segments[0];
            const lastSegment = segments[segments.length - 1];

            return [
                {
                    label: firstSegment,
                    path: `/dashboard/${firstSegment}`
                },
                {
                    label: '...'
                },
                {
                    label: lastSegment,
                    isCurrent: true
                }
            ];
        }

        return segments.map((segment, index) => ({
            label: segment,
            path: index < segments.length - 1 ? `/dashboard/${segments.slice(0, index + 1).join('/')}` : undefined,
            isCurrent: index === segments.length - 1
        }));
    }, [pathname]);

    const renderBreadcrumb = (breadcrumb: BreadcrumbItem) => {
        if (breadcrumb.path) {
            return (
                <Link to={breadcrumb.path} className='breadcrumb-item breadcrumb-link text-muted'>
                    {breadcrumb.label}
                </Link>
            );
        }

        return (
            <span
                className={`breadcrumb-item ${breadcrumb.isCurrent ? 'breadcrumb-current' : ''}`}
                aria-current={breadcrumb.isCurrent ? 'page' : undefined}
            >
                {breadcrumb.label}
            </span>
        );
    };

    return (
        <nav className='flex flex-row items-center gap-2 breadcrumb-nav text-sm' aria-label='Dashboard breadcrumbs'>
            <Link to='/dashboard' className='breadcrumb-item breadcrumb-link text-muted'>
                Dashboard
            </Link>

            {breadcrumbs.map((breadcrumb, index) => (
                <div className='flex flex-row items-center gap-2' key={`${breadcrumb.label}-${index}`}>
                    <ChevronRight className='breadcrumb-separator text-muted' size={14} />
                    {renderBreadcrumb(breadcrumb)}
                </div>
            ))}
        </nav>
    );
};

export default HeaderBreadcrumbs;
