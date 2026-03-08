import './HeaderBreadcrumbs.css';
import { useMemo } from 'react';
import { IoChevronForward } from 'react-icons/io5';
import { useLocation, useNavigate } from 'react-router-dom';
import Container from '@/shared/presentation/components/Container';

const HeaderBreadcrumbs = () => {
    const { pathname } = useLocation();
    const navigate = useNavigate();

    const breadcrumbs = useMemo(() => {
        const segments = pathname.split('/').filter(Boolean).slice(1);
        
        if (segments.length > 2) {
            segments[1] = '...';
            segments.length = 2;
        }

        return segments;
    }, [pathname]);

    const getBreadcrumbClassName = (index: number, length: number): string => {
        let className = 'breadcrumb-item breadcrumb-link color-secondary cursor-pointer';
        if (index === length - 1) {
            className = 'breadcrumb-item breadcrumb-current color-primary font-weight-5';
        }

        return className;
    };

    return (
        <nav className='breadcrumb-nav d-flex items-center gap-05 font-size-2'>
            <span
                className='breadcrumb-item breadcrumb-link color-secondary cursor-pointer'
                onClick={() => navigate('/dashboard')}
            >
                Dashboard
            </span>

            {breadcrumbs.map((segment, index, arr) => (
                <Container key={segment} className='d-flex items-center gap-05'>
                    <IoChevronForward className='breadcrumb-separator color-text-muted' size={14} />
                    <span className={getBreadcrumbClassName(index, arr.length)}>
                        {segment}
                    </span>
                </Container>
            ))}
        </nav>
    );
};

export default HeaderBreadcrumbs;
