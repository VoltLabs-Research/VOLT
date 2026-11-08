import { RUN_IN_BROWSER_URL } from '@/contracts/links';
import { ChevronRight } from 'lucide-react';

const LandingHero = () => (
    <section className='landing-wrap landing-hero' aria-labelledby='landing-hero-title'>
        <h1 id='landing-hero-title' className='landing-hero-title'>
            <span className='landing-line'><span>The AI Platform for</span></span>
            <span className='landing-line'><span className='landing-dim'>Modern Materials Research</span></span>
        </h1>
        <p className='landing-hero-lead landing-intro'>
            Collaborative visualization and analysis for particle-based simulations, with state-of-the-art algorithms that run at any scale.
        </p>
        <div className='landing-hero-actions landing-intro'>
            <a href={RUN_IN_BROWSER_URL} className='landing-pill landing-pill--lg'>
                Run in this browser
                <ChevronRight aria-hidden='true' size={16} />
            </a>
        </div>
        {/* Leads into the runtime cards below, the other ways to get VOLT. */}
        <p className='landing-hero-or landing-intro' aria-hidden='true'>or</p>
    </section>
);

export default LandingHero;
