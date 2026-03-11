import Container from '@/shared/presentation/components/Container';
import DesktopTitlebar from '@/shared/presentation/components/DesktopTitlebar';
import { useDesktopWindowState } from '@/shared/presentation/hooks/use-desktop-window-state';
import './DesktopShell.css';
import { useEffect } from 'react';
import type { PropsWithChildren, ReactNode } from 'react';

interface DesktopShellProps extends PropsWithChildren {
    children: ReactNode;
};

const DesktopShell = ({ children }: DesktopShellProps) => {
    const { isDesktop, windowState } = useDesktopWindowState();

    useEffect(() => {
        if (!isDesktop) {
            return;
        }

        document.documentElement.classList.add('desktop-window');
        document.body.classList.add('desktop-window');

        return () => {
            document.documentElement.classList.remove('desktop-window');
            document.body.classList.remove('desktop-window');
        };
    }, [isDesktop]);

    if (!isDesktop) {
        return <>{children}</>;
    }

    const shellClassName = [
        'desktop-shell',
        (windowState.isMaximized || windowState.isFullScreen) ? 'desktop-shell--maximized' : null
    ].filter(Boolean).join(' ');

    return (
        <Container className={shellClassName}>
            <DesktopTitlebar />
            <Container className='desktop-shell__content'>
                {children}
            </Container>
        </Container>
    );
};

export default DesktopShell;
