import type { SortConfig, SortDirection } from '@/shared/domain/sorting/types';

const PREFERRED_KEYS = ['name', 'title', '_id'];

const isPrimitive = (value: unknown): boolean => {
    const type = typeof value;
    return type === 'string' || type === 'number' || type === 'boolean';
};

const extractPreferredProperties = (obj: Record<string, unknown>): string[] => {
    const parts: string[] = [];
    
    for(const key of PREFERRED_KEYS){
        if(key in obj && obj[key] != null){
            parts.push(String(obj[key]));
        }
    }
    
    return parts;
};

const convertToSearchString = (value: unknown): string => {
    if(value == null) return '';
    
    if(isPrimitive(value)) return String(value);
    
    if(Array.isArray(value)){
        return value.map(convertToSearchString).join(' ');
    }
    
    if(typeof value === 'object'){
        try{
            const obj = value as Record<string, unknown>;
            const preferredParts = extractPreferredProperties(obj);
            
            if(preferredParts.length > 0){
                return preferredParts.join(' ');
            }
            
            return Object.values(obj).map(convertToSearchString).join(' ');
        }catch{
            return '';
        }
    }
    
    return '';
};

const parseNumericValue = (str: string): { value: number; isNumeric: boolean } => {
    const numValue = Number(str);
    const isNumeric = !Number.isNaN(numValue);
    
    return { value: numValue, isNumeric };
};

const compareNumericValues = (a: number, b: number, direction: SortDirection): number => {
    return direction === 'asc' ? a - b : b - a;
};

const compareStringValues = (a: string, b: string, direction: SortDirection): number => {
    return direction === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
};

const compareValues = (
    aValue: unknown, 
    bValue: unknown, 
    direction: SortDirection
): number => {
    if(aValue == null && bValue == null) return 0;
    if(aValue == null) return direction === 'asc' ? -1 : 1;
    if(bValue == null) return direction === 'asc' ? 1 : -1;
    
    const aString = convertToSearchString(aValue);
    const bString = convertToSearchString(bValue);
    
    const aNumeric = parseNumericValue(aString);
    const bNumeric = parseNumericValue(bString);
    
    if(aNumeric.isNumeric && bNumeric.isNumeric){
        return compareNumericValues(aNumeric.value, bNumeric.value, direction);
    }
    
    return compareStringValues(aString, bString, direction);
};

export const sortData = <T>(
    data: T[], 
    sortConfig: SortConfig | null, 
    getValueByPath: (obj: unknown, path: string) => unknown
): T[] => {
    if(!sortConfig) return data;
    
    const sortedData = [...data];
    
    sortedData.sort((a, b) => {
        const aValue = getValueByPath(a, sortConfig.key);
        const bValue = getValueByPath(b, sortConfig.key);
        
        return compareValues(aValue, bValue, sortConfig.direction);
    });
    
    return sortedData;
};
