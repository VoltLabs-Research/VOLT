import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { relative } from 'node:path';

interface MethodMetric{
    name: string;
    lines: number;
    startLine: number;
}

interface FileMetric{
    path: string;
    lines: number;
    methods: MethodMetric[];
    longestMethod: MethodMetric | null;
    methodCount: number;
    maxIndent: number;
}

const METHOD_PATTERN = /^(\s{4})(?:(?:public|private|protected|readonly|static|async|#|get |set )[\w #]*)?([#\w]+)\s*(?:<[^>]*>)?\([^;]*$|^(\s{4})(?:async\s+)?([#\w]+)\s*\(/;

const measureMethods = (lines: string[]): MethodMetric[] => {
    const methods: MethodMetric[] = [];
    let current: { name: string; startLine: number } | null = null;
    let depth = 0;

    lines.forEach((line, index) => {
        const trimmed = line.trim();
        if(trimmed.startsWith('//') || trimmed.startsWith('*')) return;

        if(!current){
            const match = METHOD_PATTERN.exec(line);
            if(match && !trimmed.startsWith('constructor')){
                const name = match[2] ?? match[4];
                if(name && !['if', 'for', 'while', 'switch', 'catch', 'return'].includes(name)){
                    current = { name, startLine: index + 1 };
                    depth = 0;
                }
            }
        }

        if(!current) return;

        depth += (line.match(/\{/g) ?? []).length;
        depth -= (line.match(/\}/g) ?? []).length;

        if(depth <= 0 && index + 1 > current.startLine){
            methods.push({
                name: current.name,
                startLine: current.startLine,
                lines: index + 1 - current.startLine + 1
            });
            current = null;
        }
    });

    return methods;
};

const measureIndent = (lines: string[]): number => {
    let max = 0;
    for(const line of lines){
        if(!line.trim()) continue;
        const indent = (line.match(/^ */)?.[0].length ?? 0) / 4;
        if(indent > max) max = indent;
    }
    return max;
};

const analyze = (path: string): FileMetric => {
    const lines = readFileSync(path, 'utf8').split('\n');
    const methods = measureMethods(lines);
    const sorted = [...methods].sort((left, right) => right.lines - left.lines);

    return {
        path,
        lines: lines.length,
        methods,
        methodCount: methods.length,
        longestMethod: sorted[0] ?? null,
        maxIndent: measureIndent(lines)
    };
};

const files = globSync('src/**/*.ts', { cwd: process.cwd() })
    .filter((path) => !path.endsWith('.test.ts') && !path.endsWith('.d.ts'))
    .map((path) => analyze(path));

const byLines = [...files].sort((left, right) => right.lines - left.lines);
const byMethods = [...files].sort((left, right) => right.methodCount - left.methodCount);
const byLongestMethod = [...files]
    .filter((file) => file.longestMethod)
    .sort((left, right) => right.longestMethod!.lines - left.longestMethod!.lines);
const byIndent = [...files].sort((left, right) => right.maxIndent - left.maxIndent);

const totalLines = files.reduce((sum, file) => sum + file.lines, 0);

console.log(`archivos: ${files.length}   LOC: ${totalLines}   media: ${Math.round(totalLines / files.length)}\n`);

console.log('=== 20 ARCHIVOS MAS GRANDES ===');
byLines.slice(0, 20).forEach((file) => {
    console.log(`${String(file.lines).padStart(5)}  ${file.methodCount} metodos  ${relative('src', file.path)}`);
});

console.log('\n=== 20 CLASES CON MAS METODOS ===');
byMethods.slice(0, 20).forEach((file) => {
    console.log(`${String(file.methodCount).padStart(4)} metodos  ${String(file.lines).padStart(5)} LOC  ${relative('src', file.path)}`);
});

console.log('\n=== 20 METODOS MAS LARGOS ===');
byLongestMethod.slice(0, 20).forEach((file) => {
    const method = file.longestMethod!;
    console.log(`${String(method.lines).padStart(4)} LOC  ${relative('src', file.path)}:${method.startLine}  ${method.name}()`);
});

console.log('\n=== 10 ARCHIVOS MAS ANIDADOS ===');
byIndent.slice(0, 10).forEach((file) => {
    console.log(`${file.maxIndent} niveles  ${relative('src', file.path)}`);
});

const over200 = files.filter((file) => file.lines > 200).length;
const over400 = files.filter((file) => file.lines > 400).length;
const methodsOver40 = files.flatMap((file) => file.methods).filter((method) => method.lines > 40).length;

console.log(`\n=== RESUMEN ===`);
console.log(`archivos > 200 LOC: ${over200}`);
console.log(`archivos > 400 LOC: ${over400}`);
console.log(`metodos > 40 LOC: ${methodsOver40}`);
