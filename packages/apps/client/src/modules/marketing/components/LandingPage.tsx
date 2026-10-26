import '@/modules/marketing/landing.css';
import LandingFooter from '@/modules/marketing/components/LandingFooter';
import LandingHero from '@/modules/marketing/components/LandingHero';
import LandingNav from '@/modules/marketing/components/LandingNav';
import LandingRuntimes from '@/modules/marketing/components/LandingRuntimes';
import { LandingScrollerContext } from '@/modules/marketing/hooks/use-scroll-progress';
import { useLandingReveal } from '@/modules/marketing/hooks/use-landing-reveal';
import { usePageTitle } from '@/shared/ui/hooks/use-page-title';
import { Navigate } from 'react-router-dom';

const isDesktopShell = (): boolean =>
    document.documentElement.dataset.voltDesktop === 'true'
    || navigator.userAgent.includes('Electron');

const LandingContent = () => {
    const root = useLandingReveal();

    return (
        <LandingScrollerContext.Provider value={root}>
            <div id='top' ref={root} className='landing' data-theme='dark'>
                <LandingNav />
                <main>
                    <LandingHero />
                    <LandingRuntimes />
                </main>
                <LandingFooter />
            </div>
        </LandingScrollerContext.Provider>
    );
};

const LandingPage = () => {
    usePageTitle('The AI Platform for Modern Materials Research');

    if (isDesktopShell()) {
        return <Navigate to='/dashboard' replace />;
    }

    return <LandingContent />;
};

export default LandingPage;
