import Container from '@/shared/presentation/components/Container';
import IconButton from '@/shared/presentation/components/IconButton';
import Tooltip from '@/shared/presentation/components/Tooltip';
import { useDesktopTitlebar } from './use-desktop-titlebar';
import './DesktopTitlebar.css';

interface DesktopWindowControl {
    action: () => void;
    className: string;
    label: string;
};

const DesktopTitlebar = () => {
    const {
        handleClose,
        handleMinimize,
        handleToggleMaximize,
        identityLabel,
        isDesktop,
        isMaximized
    } = useDesktopTitlebar();

    if (!isDesktop) {
        return null;
    }

    const controls: DesktopWindowControl[] = [
        {
            action: handleClose,
            className: 'desktop-titlebar__window-control--close',
            label: 'Close window'
        },
        {
            action: handleMinimize,
            className: 'desktop-titlebar__window-control--minimize',
            label: 'Minimize window'
        },
        {
            action: handleToggleMaximize,
            className: 'desktop-titlebar__window-control--maximize',
            label: isMaximized ? 'Restore window' : 'Maximize window'
        }
    ];

    return (
        <header className='desktop-titlebar'>
            <Container className='desktop-titlebar__section desktop-titlebar__controls d-flex items-center gap-05'>
                {controls.map((control) => (
                    <Tooltip key={control.label} content={control.label} placement='bottom'>
                        <IconButton
                            aria-label={control.label}
                            className={`desktop-titlebar__window-control ${control.className}`}
                            onClick={control.action}
                            size='sm'
                            variant='ghost'
                        >
                            <span aria-hidden='true' />
                        </IconButton>
                    </Tooltip>
                ))}
            </Container>

            <Container className='desktop-titlebar__section desktop-titlebar__identity'>
                <p className='desktop-titlebar__identity-label text-truncate' title={identityLabel}>
                    {identityLabel}
                </p>
            </Container>

            <Container aria-hidden='true' className='desktop-titlebar__section desktop-titlebar__spacer' />
        </header>
    );
};

export default DesktopTitlebar;
