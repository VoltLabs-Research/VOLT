import type { tags } from 'typia';

interface DrawWhiteboardElement{
    /**
     * Shape kind. Use text for labels/notes, arrow/line for connectors.
     */
    kind: 'rectangle' | 'ellipse' | 'diamond' | 'text' | 'arrow' | 'line';
    /**
     * Top-left x in scene coordinates.
     */
    x: number;
    /**
     * Top-left y in scene coordinates.
     */
    y: number;
    /**
     * Width (shapes). Defaults to 120 if omitted.
     */
    width?: number;
    /**
     * Height (shapes). Defaults to 120 if omitted.
     */
    height?: number;
    /**
     * For text: the content. For shapes/arrows: a centered label.
     */
    text?: string;
    // LLM schemas have no tuple type, so the fixed [x, y] pair is expressed as a two-item array.
    /**
     * For arrow/line: vertices relative to (x,y), e.g. [[0,0],[120,0]].
     */
    points?: (number[] & tags.MinItems<2> & tags.MaxItems<2>)[];
    /**
     * Bind an arrow tail to another element by its id (instead of points).
     */
    start?: { id: string };
    /**
     * Bind an arrow head to another element by its id (instead of points).
     */
    end?: { id: string };
    /**
     * Stable id so arrows can reference this element via start/end. Ids are regenerated on insert.
     */
    id?: string;
    /**
     * CSS color for the stroke, e.g. "#1e1e1e".
     */
    strokeColor?: string;
    /**
     * CSS fill color, e.g. "#a5d8ff". Use "transparent" for none.
     */
    backgroundColor?: string;
    /**
     * Font size for text elements.
     */
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
    /**
     * Id of the whiteboard to draw on. Create one with create_whiteboard or resolve one with list_whiteboards first — never invent it.
     */
    whiteboardId: string;
    /**
     * append (default) adds to the existing scene; replace clears it first.
     */
    mode?: 'append' | 'replace';
    /**
     * The diagram to draw, as a list of high-level elements. Compose boxes, text and arrows to build flowcharts, pipelines, mind maps, etc. Connect shapes by giving them ids and binding arrows with start/end.
     */
    elements: DrawWhiteboardElement[];
}
