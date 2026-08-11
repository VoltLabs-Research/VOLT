import { Button, cn } from '@heroui/react';
import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';

interface DashedActionBoxProps {
    label: ReactNode;
    onPress: () => void;
    icon?: ReactNode;

    isBlock?: boolean;
    isDisabled?: boolean;
    className?: string;
};

const DashedActionBox = ({ label, onPress, icon, isBlock = false, isDisabled, className }: DashedActionBoxProps) => (
    <Button
        size='sm'
        variant='ghost'
        fullWidth={isBlock}
        isDisabled={isDisabled}
        onPress={onPress}
        className={cn('h-auto gap-2 rounded-xl border border-dashed border-border-secondary bg-transparent px-3 py-2 text-xs text-muted shadow-none transition-[border-color,background-color,color] duration-150 ease-out hover:border-accent hover:bg-surface-hover hover:text-foreground', className)}
    >
        <span aria-hidden='true' className='inline-flex flex-row items-center'>
            {icon ?? <Plus size={16} />}
        </span>
        <span>{label}</span>
    </Button>
);

export default DashedActionBox;
