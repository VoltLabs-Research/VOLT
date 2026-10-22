import { SIGN_IN_PATH } from '@/modules/marketing/contracts/links';
import { runLocalStack } from '@/modules/auth/services/endpoint-session';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

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
            <Link to={SIGN_IN_PATH} className='landing-pill landing-pill--lg'>
                Open VOLT
                <ArrowRight aria-hidden='true' className='size-4' />
            </Link>
            <button type='button' className='landing-pill landing-pill--lg landing-pill--ghost' onClick={runLocalStack}>
                Run in this browser
            </button>
        </div>
    </section>
);

export default LandingHero;
