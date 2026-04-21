import Button from '@/shared/presentation/components/Button';
import { usePageTitle } from '@/shared/presentation/hooks/use-page-title';
import './NotFoundState.css';
import { SearchX } from 'lucide-react';
import { useId } from 'react';
import { useNavigate } from 'react-router-dom';

const NotFoundState = () => {
    const navigate = useNavigate();
    const headingId = useId();

    usePageTitle('Page Not Found');

    return (
        <section aria-labelledby={headingId} className='not-found-state d-flex items-center content-center vh-max w-max'>
            <div className='volt-container not-found-state-content d-flex column gap-1-5 items-center text-center'>
                <div className='volt-container not-found-state-icon d-flex items-center content-center'>
                    <SearchX size={24} />
                </div>

                <div className='volt-container d-flex column gap-05 text-center'>
                    <h1 id={headingId} className='volt-title font-size-3 font-weight-5 color-primary'>
                        Page not found
                    </h1>
                    <p className='volt-text font-size-2 color-secondary line-height-5'>
                        The page you were looking for is unavailable or may have moved.
                    </p>
                    <p className='volt-text font-size-2 color-muted'>
                        You can go back or return to the dashboard.
                    </p>
                </div>

                <div className='volt-container d-flex gap-075 items-center mt-05'>
                    <Button
                        variant='ghost'
                        intent='neutral'
                        size='sm'
                        onClick={() => navigate(-1)}
                    >
                        Back
                    </Button>
                    <Button
                        variant='solid'
                        intent='brand'
                        size='sm'
                        to='/dashboard'
                    >
                        Go to dashboard
                    </Button>
                </div>
            </div>
        </section>
    );
};

export default NotFoundState;
