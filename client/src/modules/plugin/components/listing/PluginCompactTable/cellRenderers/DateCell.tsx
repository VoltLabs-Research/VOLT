interface DateCellProps {
    value: unknown;
}

const DateCell = ({ value }: DateCellProps) => {
    if(!(value instanceof Date) || Number.isNaN(value.getTime())){
        return <span className='plugin-cell-empty'>-</span>;
    }
    const iso = value.toISOString();
    const display = iso.replace('T', ' ').replace(/\.\d+Z$/, 'Z');
    return <span className='plugin-cell-date tabular-nums' title={iso}>{display}</span>;
};

export default DateCell;
