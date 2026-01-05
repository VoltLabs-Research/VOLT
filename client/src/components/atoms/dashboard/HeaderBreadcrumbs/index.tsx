import Container from '@/components/primitives/Container';
import { useMemo } from 'react';
import { IoChevronForward } from 'react-icons/io5';
import { useLocation, useNavigate } from 'react-router-dom';

const DashboardHeaderBreadcrumbs = () => {
    const { pathname } = useLocation();
    const navigate = useNavigate();

    const breadcrumbs = useMemo(() => {
        const segments = pathname.split('/').filter(Boolean).slice(1);
        
        // If more than 2 segments, show: Dashboard > ... > last
        if(segments.length > 2){
            segments[1] = '...';
            segments.length = 2;
        }

        return segments;
    }, [pathname]);

    return (
        <nav className='breadcrumb-nav d-flex items-center gap-05'>
            <span
                className='breadcrumb-item breadcrumb-link color-secondary cursor-pointer'
                onClick={() => navigate('/dashboard')}
            >
                Dashboard
            </span>

            {breadcrumbs.map((segment, index, arr) => (
                <Container key={segment} className='d-flex items-center gap-05'>
                    <IoChevronForward className='breadcrumb-separator color-text-muted' size={14} />
                    <span className={`breadcrumb-item ${index === arr.length - 1 ? 'breadcrumb-current color-primary font-weight-5' : 'breadcrumb-link color-secondary cursor-pointer'}`}>
                        {segment}
                    </span>
                </Container>
            ))}
        
        </nav>
    );
};

export default DashboardHeaderBreadcrumbs;