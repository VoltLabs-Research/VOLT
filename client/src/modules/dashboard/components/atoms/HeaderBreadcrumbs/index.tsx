import './HeaderBreadcrumbs.css';
import { useMemo } from 'react';
import { IoChevronForward } from 'react-icons/io5';
import { useLocation, useNavigate } from 'react-router-dom';
import Container from '@/shared/presentation/components/Container';

interface BreadcrumbItem {
    label: string;
    path?: string;
    isCurrent?: boolean;
};

const HeaderBreadcrumbs = () => {
    const { pathname } = useLocation();
    const navigate = useNavigate();

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
                <button
                    type='button'
                    className='breadcrumb-item breadcrumb-link color-secondary'
                    onClick={() => navigate(path)}
                >
                    {breadcrumb.label}
                </button>
            );
        }

        return (
            <span
                className={`breadcrumb-item ${breadcrumb.isCurrent ? 'breadcrumb-current color-primary font-weight-5' : 'color-secondary'}`}
                aria-current={breadcrumb.isCurrent ? 'page' : undefined}
            >
                {breadcrumb.label}
            </span>
        );
    };

    return (
        <nav className='breadcrumb-nav d-flex items-center gap-05 font-size-2' aria-label='Dashboard breadcrumbs'>
            <button
                type='button'
                className='breadcrumb-item breadcrumb-link color-secondary'
                onClick={() => navigate('/dashboard')}
            >
                Dashboard
            </button>

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
