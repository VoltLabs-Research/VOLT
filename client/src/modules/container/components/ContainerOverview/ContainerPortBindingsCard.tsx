import EditableKeyValueCard from '@/shared/ui/components/EditableKeyValueCard';
import { Button } from '@heroui/react';
import { ContainerKeyValueList, ContainerKeyValueRow } from '../ContainerKeyValueList';
import { OVERVIEW_SECTION_TITLE_CLASS_NAMES } from './section-title';
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
            /*
             * bravais's `variant='ghost' intent='brand'` painted a transparent
             * button whose ink was `--color-brand-primary`; under VOLT's monochrome
             * accent that token is the foreground, which is what `text-foreground`
             * restates on top of HeroUI's muted ghost ink.
             */
            portAction = (
                <Button
                    variant='ghost'
                    size='sm'
                    className='text-foreground'
                    onPress={() => { void openPort(container._id, item.private); }}
                    isPending={openingPort === item.private}
                >
                    Open :{accessiblePort?.public}
                </Button>
            );
        } else if (accessiblePort?.status === 'unavailable') {
            portAction = <span className='text-xs text-muted'>Unavailable</span>;
        }

        return (
            <ContainerKeyValueList key={index}>
                <ContainerKeyValueRow label={portLabel} value='' action={portAction} />
            </ContainerKeyValueList>
        );
    };

    return (
        <EditableKeyValueCard<PortMappingFormItem>
            title='Port Bindings'
            titleClassName={OVERVIEW_SECTION_TITLE_CLASS_NAMES}
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
