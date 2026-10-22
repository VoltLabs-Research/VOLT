import { DOCS_URL, GITHUB_URL, REGISTRY_URL } from '@/modules/marketing/contracts/links';
import { GITHUB_RELEASES_LATEST } from '@/modules/marketing/contracts/release';

const COLUMNS = [
    {
        heading: 'Product',
        links: [
            { href: '#viewer', label: 'Viewer' },
            { href: '#together', label: 'Collaboration' },
            { href: '#plugins', label: 'Plugins' },
            { href: GITHUB_RELEASES_LATEST, label: 'Download' }
        ]
    },
    {
        heading: 'Developers',
        links: [
            { href: DOCS_URL, label: 'Documentation' },
            { href: REGISTRY_URL, label: 'Plugin registry' },
            { href: '#build', label: 'Build a plugin' },
            { href: GITHUB_URL, label: 'GitHub' }
        ]
    }
];

const LandingFooter = () => (
    <footer className='landing-footer'>
        <div className='landing-wrap landing-footer-grid'>
            <div className='landing-footer-about'>
                <a href='#top' className='landing-brand'>VOLT</a>
                <p>The platform for modern materials research.</p>
            </div>
            {COLUMNS.map((column) => (
                <nav key={column.heading} aria-label={column.heading}>
                    <p>{column.heading}</p>
                    {column.links.map((link) => (
                        <a key={link.label} href={link.href} className='landing-quiet'>{link.label}</a>
                    ))}
                </nav>
            ))}
            <div className='landing-footer-base'>
                <span>© 2026 VOLT Labs</span>
                <span>Talca, Chile</span>
            </div>
        </div>
        <p aria-hidden='true' className='landing-wordmark'>VOLT</p>
    </footer>
);

export default LandingFooter;
