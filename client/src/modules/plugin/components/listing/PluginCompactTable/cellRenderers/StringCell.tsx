interface StringCellProps {
    value: unknown;
};

const StringCell = ({ value }: StringCellProps) => {
    if(typeof value !== 'string'){
        return <span className='plugin-cell-empty'>-</span>;
    }
    if(value.length === 0){
        return <span className='plugin-cell-empty'>-</span>;
    }
    return <span className='plugin-cell-string' title={value}>{value}</span>;
};

export default StringCell;
