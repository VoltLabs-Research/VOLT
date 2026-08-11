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
                <Link to={breadcrumb.path} className='capitalize transition-colors duration-150 ease-[ease] inline-flex p-0 border-none bg-transparent no-underline whitespace-nowrap cursor-pointer text-muted hover:text-foreground focus-visible:outline-none focus-visible:text-foreground focus-visible:rounded-lg focus-visible:shadow-[0_0_0_1px_var(--border),0_0_0_3px_var(--focus)]'>
                    {breadcrumb.label}
                </Link>
            );
        }

        return (
            <span
                className={breadcrumb.isCurrent ? 'capitalize transition-colors duration-150 ease-[ease] cursor-default' : 'capitalize transition-colors duration-150 ease-[ease]'}
                aria-current={breadcrumb.isCurrent ? 'page' : undefined}
            >
                {breadcrumb.label}
            </span>
        );
    };

    return (
        <nav className='flex flex-row items-center gap-2 text-sm max-[768px]:flex-nowrap max-[768px]:overflow-x-auto max-[768px]:overflow-y-hidden max-[768px]:[&>*]:shrink-0 max-[420px]:[&>*:not(:last-child)]:hidden' aria-label='Dashboard breadcrumbs'>
            <Link to='/dashboard' className='capitalize transition-colors duration-150 ease-[ease] inline-flex p-0 border-none bg-transparent no-underline whitespace-nowrap cursor-pointer text-muted hover:text-foreground focus-visible:outline-none focus-visible:text-foreground focus-visible:rounded-lg focus-visible:shadow-[0_0_0_1px_var(--border),0_0_0_3px_var(--focus)]'>
                Dashboard
            </Link>

            {breadcrumbs.map((breadcrumb, index) => (
                <div className='flex flex-row items-center gap-2' key={`${breadcrumb.label}-${index}`}>
                    <ChevronRight className='text-muted opacity-50' size={14} />
                    {renderBreadcrumb(breadcrumb)}
                </div>
            ))}
        </nav>
    );
};

export default HeaderBreadcrumbs;
