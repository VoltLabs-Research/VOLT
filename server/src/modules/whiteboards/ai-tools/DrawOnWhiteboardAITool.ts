import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

const drawElement = z.object({
    kind: z.enum(['rectangle', 'ellipse', 'diamond', 'text', 'arrow', 'line'])
        .describe('Shape kind. Use text for labels/notes, arrow/line for connectors.'),
    x: z.number().describe('Top-left x in scene coordinates.'),
    y: z.number().describe('Top-left y in scene coordinates.'),
    width: z.number().optional().describe('Width (shapes). Defaults to 120 if omitted.'),
    height: z.number().optional().describe('Height (shapes). Defaults to 120 if omitted.'),
    text: z.string().optional().describe('For text: the content. For shapes/arrows: a centered label.'),
    points: z.array(z.tuple([z.number(), z.number()])).optional()
        .describe('For arrow/line: vertices relative to (x,y), e.g. [[0,0],[120,0]].'),
    start: z.object({ id: z.string() }).optional()
        .describe('Bind an arrow tail to another element by its id (instead of points).'),
    end: z.object({ id: z.string() }).optional()
        .describe('Bind an arrow head to another element by its id (instead of points).'),
    id: z.string().optional()
        .describe('Stable id so arrows can reference this element via start/end. Ids are regenerated on insert.'),
    strokeColor: z.string().optional().describe('CSS color for the stroke, e.g. "#1e1e1e".'),
    backgroundColor: z.string().optional().describe('CSS fill color, e.g. "#a5d8ff". Use "transparent" for none.'),
    fontSize: z.number().optional().describe('Font size for text elements.')
});

const parameters = z.object({
    whiteboardId: z.string().describe(
        'Id of the whiteboard to draw on. Create one with create_whiteboard or resolve one with '
        + 'list_whiteboards first — never invent it.'
    ),
    mode: z.enum(['append', 'replace']).optional().describe(
        'append (default) adds to the existing scene; replace clears it first.'
    ),
    elements: z.array(drawElement).describe(
        'The diagram to draw, as a list of high-level elements. Compose boxes, text and arrows to '
        + 'build flowcharts, pipelines, mind maps, etc. Connect shapes by giving them ids and binding '
        + 'arrows with start/end.'
    )
});

type DrawOnWhiteboardParams = z.infer<typeof parameters>;

export class DrawOnWhiteboardAITool extends AITool<DrawOnWhiteboardParams> {
    readonly name = 'draw_on_whiteboard';
    readonly description = 'Draw actual content (boxes, text, arrows, lines, ellipses, diamonds) onto a '
        + 'whiteboard so the user sees the diagram appear live. Provide a list of high-level elements; '
        + 'connect shapes by giving them ids and binding arrows with start/end. Use this to build '
        + 'flowcharts, pipelines, mind maps and sketches — do not just create an empty board. '
        + 'Resolve the whiteboardId with create_whiteboard / list_whiteboards first.';
    readonly parameters = parameters;
    protected readonly clientExecuted = true;
}
