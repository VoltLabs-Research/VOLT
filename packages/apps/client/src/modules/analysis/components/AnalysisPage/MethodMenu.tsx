import { Button, Popover, cn } from '@heroui/react';
import { Check, ChevronDown, X } from 'lucide-react';
import { useState } from 'react';
import Scrollable from '@/shared/ui/components/Scrollable';

export interface MethodOption {
    id: string;
    name: string;
    count: number;
}

interface MethodMenuProps {
    value: string | null;
    valueLabel?: string;
    methods: MethodOption[];
    // Installed methods with no run in the list, offered below the rest.
    otherMethods: MethodOption[];
    onChange: (pluginId: string | null) => void;
}

const MethodMenu = ({ value, valueLabel, methods, otherMethods, onChange }: MethodMenuProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const total = methods.reduce((sum, method) => sum + method.count, 0);

    const choose = (pluginId: string | null) => {
        onChange(pluginId);
        setIsOpen(false);
    };

    const renderItem = (id: string | null, name: string, count: number, muted = false) => (
        <button
            key={id ?? 'all'}
            type='button'
            role='menuitemradio'
            aria-checked={value === id}
            onClick={() => choose(id)}
            className={cn(
                'flex w-full cursor-pointer items-center gap-3 rounded-lg border-0 bg-transparent px-2.5 py-1.5 text-left text-sm hover:bg-foreground/[0.06]',
                value === id && 'bg-foreground/[0.09] font-medium',
                muted ? 'text-muted' : 'text-foreground'
            )}
        >
            <span className='min-w-0 flex-1 truncate'>{name}</span>
            <span className='font-mono text-2xs text-muted'>{count}</span>
            {value === id && <Check size={14} aria-hidden='true' />}
        </button>
    );

    return (
        <div className='inline-flex items-center'>
            <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
                <Button
                    variant='outline'
                    size='sm'
                    className={cn('h-8 max-w-72 gap-1.5 rounded-lg border-border px-2.5 text-sm font-normal', value && 'rounded-r-none border-r-0')}
                >
                    <span className='text-muted'>Method</span>
                    <span className='truncate font-medium text-foreground'>{value ? valueLabel ?? 'Selected' : 'All'}</span>
                    {!value && <ChevronDown size={14} className='shrink-0 text-muted' aria-hidden='true' />}
                </Button>
                <Popover.Content placement='bottom start'>
                    <Popover.Dialog aria-label='Method' className='w-72 p-0'>
                        <Scrollable className='flex max-h-[440px] flex-col p-1.5'>
                        {renderItem(null, 'All methods', total)}
                        {methods.map((method) => renderItem(method.id, method.name, method.count))}
                        {otherMethods.length > 0 && (
                            <>
                                <div className='px-2.5 pb-1 pt-2.5 text-2xs text-muted'>No runs in this list</div>
                                {otherMethods.map((method) => renderItem(method.id, method.name, 0, true))}
                            </>
                        )}
                        </Scrollable>
                    </Popover.Dialog>
                </Popover.Content>
            </Popover>
            {value && (
                <Button variant='outline' size='sm' isIconOnly aria-label='Clear method' onPress={() => onChange(null)} className='h-8 min-w-8 rounded-l-none border-border'>
                    <X size={13} aria-hidden='true' />
                </Button>
            )}
        </div>
    );
};

export default MethodMenu;
