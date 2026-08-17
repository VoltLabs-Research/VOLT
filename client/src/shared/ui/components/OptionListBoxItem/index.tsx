import { Description, Label, ListBox } from '@heroui/react';

import type { SelectOption } from '@/shared/contracts/form-field';

interface OptionListBoxItemProps {
    option: SelectOption;

    showIndicator?: boolean;
}

const OptionListBoxItem = ({ option, showIndicator = true }: OptionListBoxItemProps) => (
    <ListBox.Item
        id={option.value}
        textValue={option.title}
        className={showIndicator ? 'pe-7' : undefined}
    >
        {showIndicator && <ListBox.ItemIndicator />}
        <div className='flex min-w-0 flex-col items-start'>
            <Label className='min-w-0 max-w-full truncate'>{option.title}</Label>
            {option.description && (
                <Description className='min-w-0 max-w-full truncate'>{option.description}</Description>
            )}
        </div>
    </ListBox.Item>
);

export default OptionListBoxItem;
