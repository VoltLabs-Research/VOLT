interface BooleanCellProps {
    value: unknown;
}

const BooleanCell = ({ value }: BooleanCellProps) => {
    if(value === true){
        return <span className='plugin-cell-bool plugin-cell-bool--true' title='true' aria-label='true'>✓</span>;
    }
    if(value === false){
        return <span className='plugin-cell-bool plugin-cell-bool--false' title='false' aria-label='false'>✕</span>;
    }
    return <span className='plugin-cell-empty'>-</span>;
};

export default BooleanCell;
