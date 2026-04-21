import Button from '@/shared/presentation/components/Button';
import CloseButton from '@/shared/presentation/components/CloseButton';
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
        <div className='volt-container panel-header-bordered d-flex items-center content-between f-shrink-0'>
            {title ? (
                <h3 className='volt-title font-size-4 font-weight-6 flex-1'>
                    {title}
                </h3>
            ) : tabs && tabs.length > 0 ? (
                <div className='volt-container d-flex flex-1 gap-025'>
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
