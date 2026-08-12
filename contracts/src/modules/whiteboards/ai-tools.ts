import type { tags } from 'typia';

interface DrawWhiteboardElement{
    kind: 'rectangle' | 'ellipse' | 'diamond' | 'text' | 'arrow' | 'line';
    x: number;
    y: number;
    width?: number;
    height?: number;
    text?: string;
    points?: (number[] & tags.MinItems<2> & tags.MaxItems<2>)[];
    start?: { id: string };
    end?: { id: string };
    id?: string;
    strokeColor?: string;
    backgroundColor?: string;
    fontSize?: number;
}

export interface WhiteboardRefInput{
    whiteboardId: string;
}

export interface CreateWhiteboardInput{
    title: string;
    folderId?: string | null;
}

export interface ListWhiteboardsInput{
    page?: number & tags.Default<1>;
    limit?: number & tags.Default<50>;
    folderId?: string;
}

export interface UpdateWhiteboardInput{
    whiteboardId: string;
    title?: string;
}

export interface MoveWhiteboardInput{
    whiteboardId: string;
    folderId: string | null;
}

export interface DeleteWhiteboardFolderInput{
    folderId: string;
}

export interface DrawOnWhiteboardInput{
    whiteboardId: string;
    mode?: 'append' | 'replace';
    elements: DrawWhiteboardElement[];
}
