interface IntegerCellProps {
    value: unknown;
};

const IntegerCell = ({ value }: IntegerCellProps) => {
    if(typeof value === 'number' && Number.isFinite(value)){
        const text = String(value);
        return <span className='plugin-cell-integer tabular-nums'>{text}</span>;
    }
    if(typeof value === 'bigint'){
        return <span className='plugin-cell-integer tabular-nums'>{value.toString()}</span>;
    }
    return <span className='plugin-cell-empty'>-</span>;
};

export default IntegerCell;
