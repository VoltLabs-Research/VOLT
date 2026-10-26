import { DOCS_URL, SIGN_IN_PATH } from '@/modules/marketing/contracts/links';
import { useScrolledPast } from '@/modules/marketing/hooks/use-scroll-progress';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const SECTIONS = [
    { href: '#anywhere', label: 'Get started' }
];

const LandingNav = () => {
    const isScrolled = useScrolledPast(24);

    return (
        <header className='landing-header' data-scrolled={isScrolled}>
            <div className='landing-wrap landing-header-row'>
                <a href='#top' className='landing-brand'>VOLT</a>
                <nav aria-label='Sections' className='landing-header-links'>
                    {SECTIONS.map((section) => (
                        <a key={section.href} href={section.href} className='landing-quiet'>{section.label}</a>
                    ))}
                    <a href={DOCS_URL} className='landing-quiet'>Docs</a>
                </nav>
                <div className='landing-header-actions'>
                    <Link to={SIGN_IN_PATH} className='landing-header-sign-in'>Sign in</Link>
                    <Link to={SIGN_IN_PATH} className='landing-pill'>
                        Open VOLT
                        <ArrowRight aria-hidden='true' className='size-3.5' />
                    </Link>
                </div>
            </div>
        </header>
    );
};

export default LandingNav;
