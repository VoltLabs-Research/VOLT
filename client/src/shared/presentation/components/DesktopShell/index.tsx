import Container from '@/shared/presentation/components/Container';
import DesktopTitlebar from '@/shared/presentation/components/DesktopTitlebar';
import { isElectronEnvironment } from '@/shared/utils/electron-environment';
import './DesktopShell.css';
import type { PropsWithChildren, ReactNode } from 'react';

interface DesktopShellProps extends PropsWithChildren {
    children: ReactNode;
};

const DesktopShell = ({ children }: DesktopShellProps) => {
    if (!isElectronEnvironment()) {
        return <>{children}</>;
    }

    return (
        <Container className='desktop-shell'>
            <DesktopTitlebar />
            <Container className='desktop-shell__content'>
                {children}
            </Container>
        </Container>
    );
};

export default DesktopShell;
