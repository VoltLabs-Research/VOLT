import { DOCS_URL, SIGN_IN_URL, VOLT_APP_URL } from '@/contracts/links';
import { useScrolledPast } from '@/hooks/use-scrolled-past';
import { ArrowRight } from 'lucide-react';

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
                    <a href={SIGN_IN_URL} className='landing-header-sign-in'>Sign in</a>
                    <a href={VOLT_APP_URL} className='landing-pill'>
                        Open VOLT
                        <ArrowRight aria-hidden='true' size={14} />
                    </a>
                </div>
            </div>
        </header>
    );
};

export default LandingNav;
