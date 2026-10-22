import { runLocalStack } from '@/modules/auth/services/endpoint-session';
import { SIGN_IN_PATH } from '@/modules/marketing/contracts/links';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const LandingClosing = () => (
    <section id='start' className='landing-wrap landing-closing'>
        <h2 className='landing-closing-title landing-rise'>
            <span>Bring the</span>
            <span className='landing-dim'>whole lab.</span>
        </h2>
        <div className='landing-hero-actions landing-rise'>
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

export default LandingClosing;
