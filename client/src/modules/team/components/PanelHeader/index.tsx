import { Button, CloseButton } from '@/shared/presentation/primitives';
interface PanelTab {
    label: string;
    active: boolean;
    disabled?: boolean;
    onClick?: () => void;
};

interface PanelHeaderProps {
    tabs?: PanelTab[];
    onClose?: () => void;
    title?: string;
};

export const PanelHeader = ({
    tabs,
    onClose,
    title
}: PanelHeaderProps) => {
    return (
        <div className='panel-header-bordered d-flex items-center content-between f-shrink-0'>
            {title ? (
                <h3 className='font-size-4 font-weight-6 flex-1'>
                    {title}
                </h3>
            ) : tabs && tabs.length > 0 ? (
                <div className='d-flex flex-1 gap-025'>
                    {tabs.map((tab, index) => (
                        <Button
                            key={index}
                            variant='ghost'
                            intent={tab.active ? 'brand' : 'neutral'}
                            size='sm'
                            onClick={tab.onClick}
                            disabled={tab.disabled}
                            style={tab.disabled ? { opacity: 0.5 } : undefined}
                        >
                            {tab.label}
                        </Button>
                    ))}
                </div>
            ) : null}

            {onClose && <CloseButton onClick={onClose} />}
        </div>
    );
};
