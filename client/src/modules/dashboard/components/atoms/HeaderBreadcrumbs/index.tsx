import './HeaderBreadcrumbs.css';
import { useMemo } from 'react';
import { IoChevronForward } from 'react-icons/io5';
import { Link, useLocation } from 'react-router-dom';
import Container from '@/shared/presentation/components/Container';

interface BreadcrumbItem {
    label: string;
    path?: string;
    isCurrent?: boolean;
};

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
            const { path } = breadcrumb;

            return (
                <Link to={path} className='breadcrumb-item breadcrumb-link color-secondary'>
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
        <nav className='breadcrumb-nav d-flex items-center gap-05 font-size-2' aria-label='Dashboard breadcrumbs'>
            <Link to='/dashboard' className='breadcrumb-item breadcrumb-link color-secondary'>
                Dashboard
            </Link>

            {breadcrumbs.map((breadcrumb, index) => (
                <Container key={`${breadcrumb.label}-${index}`} className='d-flex items-center gap-05'>
                    <IoChevronForward className='breadcrumb-separator color-text-muted' size={14} />
                    {renderBreadcrumb(breadcrumb)}
                </Container>
            ))}
        </nav>
    );
};

export default HeaderBreadcrumbs;
