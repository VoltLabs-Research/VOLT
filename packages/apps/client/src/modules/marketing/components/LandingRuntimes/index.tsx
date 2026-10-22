import { runLocalStack } from '@/modules/auth/services/endpoint-session';
import { useDesktopDownload } from '@/modules/marketing/hooks/use-desktop-download';
import { ChevronRight, Globe, Monitor, Server } from 'lucide-react';

const DEPLOY = 'curl -fsSL https://raw.githubusercontent.com/voltlabs-research/volt/main/packages/apps/desktop/scripts/deploy.sh | bash';

const LandingRuntimes = () => {
    const download = useDesktopDownload();

    return (
        <section id='anywhere' aria-label='Get started' className='landing-wrap landing-runtimes-section'>
            <div className='landing-runtimes'>
                <article className='landing-runtime landing-runtime--lead landing-rise'>
                    <Server aria-hidden='true' className='size-5' />
                    <h3>On your server</h3>
                    <p>Deploy VOLT once and enroll the machines that will compute: cloud instances, workstations, HPC nodes. Each cluster runs the analyses sent to it, and the dashboard follows its CPU, memory, disk and network.</p>
                    <pre className='landing-code'>{DEPLOY}</pre>
                </article>

                <article className='landing-runtime landing-rise'>
                    <Monitor aria-hidden='true' className='size-5' />
                    <h3>On your desktop</h3>
                    <p>The app ships the whole stack and runs it on your machine, with native analyses and no Docker, database or anything else to set up.</p>
                    <a href={download.href} className='landing-pill landing-pill--ghost'>
                        Download{download.version ? ` ${download.version}` : ''}
                        <ChevronRight aria-hidden='true' className='size-3' />
                    </a>
                </article>

                <article className='landing-runtime landing-rise'>
                    <Globe aria-hidden='true' className='size-5' />
                    <h3>Without a server</h3>
                    <p>To try it first: the server, the cluster and the analyses run in this tab, compiled to WebAssembly. Nothing to install, and your workspace stays in this browser between visits.</p>
                    <button type='button' className='landing-pill landing-pill--ghost' onClick={runLocalStack}>
                        Run in this browser
                        <ChevronRight aria-hidden='true' className='size-3' />
                    </button>
                </article>
            </div>
        </section>
    );
};

export default LandingRuntimes;
