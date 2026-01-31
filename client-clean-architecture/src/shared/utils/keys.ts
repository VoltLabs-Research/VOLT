interface Identifiable {
    _id?: string | number;
    id?: string | number;
};

export const extractItemKey = <T>(item: T, index: number): string | number => {
    const record = item as unknown as Identifiable;
    
    if(record._id != null) return record._id;
    if(record.id != null) return record.id;
    
    return index;
};