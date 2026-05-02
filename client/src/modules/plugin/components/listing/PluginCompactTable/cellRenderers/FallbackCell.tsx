import { formatUnknownValue } from '@/shared/utils/format';

interface FallbackCellProps {
    value: unknown;
}

const FallbackCell = ({ value }: FallbackCellProps) => {
    if(value === null || value === undefined){
        return <span className='plugin-cell-empty'>-</span>;
    }
    const text = formatUnknownValue(value);
    return <span className='plugin-cell-fallback' title={text}>{text}</span>;
};

export default FallbackCell;
