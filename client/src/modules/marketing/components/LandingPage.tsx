import '@/modules/marketing/landing.css';
import { useDesktopDownload } from '@/modules/marketing/hooks/use-desktop-download';
import { usePageTitle } from '@/shared/ui/hooks/use-page-title';
import { Link, Navigate } from 'react-router-dom';

const DOCS = 'https://docs.voltcloud.dev';
const REGISTRY = 'https://registry.voltcloud.dev';
const APP = '/auth/sign-in';

const isDesktopShell = (): boolean =>
    document.documentElement.dataset.voltDesktop === 'true'
    || navigator.userAgent.includes('Electron');

const LandingPage = () => {
    usePageTitle('The Platform for Modern Materials Research');
    const download = useDesktopDownload();

    if (isDesktopShell()) {
        return <Navigate to='/dashboard' replace />;
    }

    return (
        <div id='top' className='landing min-h-dvh overflow-x-hidden' data-theme='dark'>
            <header className='sticky top-0 z-50 bg-[rgba(10,10,10,0.82)] backdrop-blur-[14px]'>
                <div className='landing-wrap flex h-[64px] items-center'>
                    <a href='#top' className='text-[1.25rem] tracking-[-0.026em] text-[var(--lp-fg)] no-underline'>VOLT</a>
                    <nav aria-label='Product' className='ms-10 hidden items-center gap-6 md:flex'>
                        <a href={DOCS} className='landing-quiet text-[0.875rem]'>Docs</a>
                        <a href={REGISTRY} className='landing-quiet text-[0.875rem]'>Plugins</a>
                        <a href={download.href} className='landing-quiet text-[0.875rem]'>Download</a>
                    </nav>
                    <div className='ms-auto flex items-center gap-5'>
                        <Link to={APP} className='hidden text-[0.875rem] font-medium tracking-[-0.008em] text-[var(--lp-fg)] no-underline md:inline'>
                            Sign in
                        </Link>
                        <Link to={APP} className='landing-pill'>
                            Open VOLT
                            <span aria-hidden='true'>›</span>
                        </Link>
                    </div>
                </div>
            </header>

            <main>
                <section className='landing-hero'>
                    <div className='landing-hero-copy'>
                        <h1 className='landing-display'>The Platform for Modern Materials Research</h1>
                        <a href={download.href} className='landing-pill landing-pill--lg'>
                            Download now
                        </a>
                    </div>
                </section>
            </main>

            <footer className='landing-wrap flex flex-wrap items-center justify-between gap-3 py-5 text-[0.75rem] text-[var(--lp-faint)]'>
                <span>© 2026 VOLT Labs</span>
                <span className='hidden sm:inline'>Talca, Chile</span>
            </footer>
        </div>
    );
};

export default LandingPage;
