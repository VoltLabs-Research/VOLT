import '@/landing.css';
import LandingFooter from '@/components/LandingFooter';
import LandingHero from '@/components/LandingHero';
import LandingNav from '@/components/LandingNav';
import LandingRuntimes from '@/components/LandingRuntimes';
import { useLandingReveal } from '@/hooks/use-landing-reveal';

const LandingPage = () => {
    const root = useLandingReveal();

    return (
        <div id='top' ref={root} className='landing'>
            <LandingNav />
            <main>
                <LandingHero />
                <LandingRuntimes />
            </main>
            <LandingFooter />
        </div>
    );
};

export default LandingPage;
