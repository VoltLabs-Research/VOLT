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
            <Container className='desktop-titlebar__controls d-flex items-center gap-05' role='toolbar' aria-label='Window controls'>
                {controls.map((control) => (
                    <Tooltip key={control.label} content={control.label} placement='bottom'>
                        <IconButton
                            aria-label={control.label}
                            className={`desktop-titlebar__window-control ${control.className}`}
                            onClick={control.action}
                            size='sm'
                            variant='ghost'
                        >
                            <span className='desktop-titlebar__window-control-dot' aria-hidden='true' />
                        </IconButton>
                    </Tooltip>
                ))}
            </Container>
            <div className='desktop-titlebar__drag-region' data-tauri-drag-region aria-hidden='true' />
        </header>
    );
};

export default DesktopTitlebar;
