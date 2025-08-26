export type RasterFrameItem = {
    frame: number | null;
    filename: string;
    url: string; 
    mime: 'image/png';
    size: number;
    mtime: number;
    data?: string; 
};

export type RasterQuery = {
    includeData?: boolean;  
    offset?: number; 
    limit?: number; 
    match?: string; 
};

export type RasterPage = {
    items: RasterFrameItem[];
    total: number;     
    offset: number;
    limit: number | null;
    includeData: boolean;
    match?: string;
    fetchedAt: number;
};
