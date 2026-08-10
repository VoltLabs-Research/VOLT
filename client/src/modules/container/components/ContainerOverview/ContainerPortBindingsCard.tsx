import EditableKeyValueCard from '@/shared/ui/components/EditableKeyValueCard';
import { Button, KeyValueList, KeyValueRow } from '@voltstack/bravais';
import { useOpenContainerPort } from '@/modules/container/hooks/use-open-container-port';
import { isBrowserAccessiblePort } from '@/modules/container/utils/get-primary-accessible-port';
import { normalizePortMapping } from '@/modules/container/utils/port-mapping';
import type { ReactNode } from 'react';
import type { Container, PortMapping } from '@volt/contracts/modules/container/domain';
import type { PortMappingFormItem } from '@/modules/container/contracts/forms';
import type { FieldConfig } from '@/shared/ui/components/EditableKeyValueCard';

interface ContainerPortBindingsCardProps {
    container: Container;
    onUpdatePorts: (ports: PortMapping[]) => Promise<void>;
}

const PORT_FIELDS: FieldConfig[] = [
    {
        key: 'private',
        placeholder: 'Container Port',
        type: 'number'
    },
    {
        key: 'public',
        placeholder: 'Host Port',
        type: 'number'
    }
];

const ContainerPortBindingsCard = ({ container, onUpdatePorts }: ContainerPortBindingsCardProps) => {
    const { openPort, openingPort } = useOpenContainerPort();

    const portItems: PortMappingFormItem[] = container.ports.map((port) => ({
        private: port.private,
        public: port.public
    }));

    const renderPortRow = (item: PortMappingFormItem, index: number) => {
        const { public: publicPort } = normalizePortMapping(item);
        const accessiblePort = container.accessiblePorts?.find((port) => port.private === item.private);

        const portLabel = (
            <div className='flex flex-row items-center gap-2'>
                <span className='tabular-nums'>{item.private}/tcp</span>
                {publicPort !== undefined && (
                    <>
                        <span className='text-muted'>→</span>
                        <span className='tabular-nums text-muted'>{publicPort}</span>
                    </>
                )}
            </div>
        );

        let portAction: ReactNode = <span className='text-xs text-muted'>TCP only</span>;

        if (isBrowserAccessiblePort(accessiblePort)) {
            portAction = (
                <Button
                    variant='ghost'
                    intent='brand'
                    size='sm'
                    onClick={() => openPort(container._id, item.private)}
                    isLoading={openingPort === item.private}
                >
                    Open :{accessiblePort?.public}
                </Button>
            );
        } else if (accessiblePort?.status === 'unavailable') {
            portAction = <span className='text-xs text-muted'>Unavailable</span>;
        }

        return (
            <KeyValueList key={index}>
                <KeyValueRow label={portLabel} value='' action={portAction} />
            </KeyValueList>
        );
    };

    return (
        <EditableKeyValueCard<PortMappingFormItem>
            title='Port Bindings'
            titleClassName='container-overview-section-title'
            items={portItems}
            fields={PORT_FIELDS}
            emptyMessage='No ports exposed'
            onSave={onUpdatePorts}
            createEmpty={() => ({ private: 0 })}
            showCard={false}
            className='flex flex-col'
            renderItem={renderPortRow}
        />
    );
};

export default ContainerPortBindingsCard;
