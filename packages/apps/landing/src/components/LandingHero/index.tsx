import { GITHUB_URL } from '@/contracts/links';
import { ArrowUpRight } from 'lucide-react';

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
            <a href={GITHUB_URL} className='landing-pill landing-pill--lg landing-pill--ghost'>
                View on GitHub
                <ArrowUpRight aria-hidden='true' size={16} />
            </a>
        </div>
    </section>
);

export default LandingHero;
