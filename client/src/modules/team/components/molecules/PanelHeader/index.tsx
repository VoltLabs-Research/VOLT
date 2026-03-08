import Button from '@/shared/presentation/components/Button';
import CloseButton from '@/shared/presentation/components/CloseButton';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';

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
        <Container className='panel-header-bordered d-flex items-center content-between f-shrink-0'>
            {title ? (
                <Title className='font-size-4 font-weight-6 flex-1'>
                    {title}
                </Title>
            ) : tabs && tabs.length > 0 ? (
                <Container className='d-flex flex-1 gap-025'>
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
                </Container>
            ) : null}

            {onClose && <CloseButton onClick={onClose} />}
        </Container>
    );
};
