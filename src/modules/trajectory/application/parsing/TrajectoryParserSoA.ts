/**
 * Structure-of-Arrays (SoA) projections of `ParsedTrajectory` for the binary
 * reverse channel. This lives in a sibling file to `TrajectoryParser.ts` so
 * the parser rewrite can integrate it without merge conflicts.
 *
 * The AoS (`{id, type, x, y, z, ...}[]`) representation used by
 * `getAtomsPage` is fine for small paginated JSON responses but degrades
 * severely when the payload is binary:
 *  - 5 `number` properties per atom = 40 bytes per atom (V8 Smi tagging).
 *  - GC pressure proportional to `limit`.
 *  - Must be serialized into JSON at the transport layer.
 *
 * SoA gives us column-oriented typed arrays that travel as native Socket.IO
 * binary attachments without copy.
 */

import type { ParsedTrajectory } from '@/modules/trajectory/application/parsing/TrajectoryParser';

export interface AtomsPageSoAResult {
    /** Atom ids for the page. */
    ids: Uint32Array;
    /** Atom types for the page. */
    types: Uint16Array;
    /** Interleaved xyz positions (3 floats per atom). */
    positions: Float32Array;
    /** Per-property Float32Array slices (column order = `propertyNames`). */
    propsMap: Record<string, Float32Array>;
    /** Canonical property ordering matching `propsMap` keys. */
    propertyNames: string[];
    /** Total atoms in the frame (all pages combined). */
    totalAtoms: number;
};

export interface AtomsPageSoAInput {
    startIndex: number;
    endIndex: number;
};

/**
 * Projects a page of atoms into SoA typed arrays. The returned buffers are
 * fresh allocations (no aliasing with `parsed.*`) so the caller can safely
 * hand them over to Socket.IO (which will consume the underlying `buffer`).
 */
export const projectAtomsPageSoA = (
    parsed: ParsedTrajectory,
    range: AtomsPageSoAInput
): AtomsPageSoAResult => {
    const startIndex = Math.max(0, range.startIndex);
    const totalAtoms = parsed.ids ? parsed.ids.length : parsed.positions.length / 3;
    const endIndex = Math.min(totalAtoms, range.endIndex);
    const pageCount = Math.max(0, endIndex - startIndex);

    const ids = new Uint32Array(pageCount);
    const types = new Uint16Array(pageCount);
    const positions = new Float32Array(pageCount * 3);

    if (pageCount > 0) {
        if (parsed.ids) {
            for (let i = 0; i < pageCount; i++) {
                ids[i] = parsed.ids[startIndex + i];
            }
        } else {
            // Why: synthetic 1-based ids when the dump doesn't carry them
            // natively; matches the AoS `getAtomsPage` fallback.
            for (let i = 0; i < pageCount; i++) {
                ids[i] = startIndex + i + 1;
            }
        }

        for (let i = 0; i < pageCount; i++) {
            types[i] = parsed.types[startIndex + i];
        }

        // Why: `set` with a typed-array view is a single memcpy per axis
        // of the interleaved layout — much cheaper than an index-by-index
        // copy. We slice the source row range first (also a memcpy).
        positions.set(parsed.positions.subarray(startIndex * 3, endIndex * 3));
    }

    const propsMap: Record<string, Float32Array> = {};
    const propertyNames: string[] = [];
    if (parsed.properties) {
        for (const name of Object.keys(parsed.properties)) {
            const column = parsed.properties[name];
            const slice = new Float32Array(pageCount);
            if (pageCount > 0) {
                slice.set(column.subarray(startIndex, endIndex));
            }
            propsMap[name] = slice;
            propertyNames.push(name);
        }
    }

    return { ids, types, positions, propsMap, propertyNames, totalAtoms };
};

/**
 * Serializes an `AtomsPageSoAResult` into a single `Uint8Array` suitable for
 * the binary envelope payload. Layout:
 *
 *   [u32 totalAtoms]
 *   [u32 pageCount]
 *   [u16 propertyCount]
 *   for each property:
 *     [u16 nameLen][utf8 name bytes]
 *   [ids:  Uint32Array ×pageCount]  (little-endian)
 *   [types: Uint16Array ×pageCount]
 *   [positions: Float32Array ×pageCount*3]
 *   for each property:
 *     [values: Float32Array ×pageCount]
 *
 * Typed-array blocks are contiguous and 4-byte aligned via explicit padding
 * so the client can cast the buffer without a copy.
 */
export const encodeAtomsPageSoA = (result: AtomsPageSoAResult): Uint8Array => {
    const pageCount = result.ids.length;

    const encoder = new TextEncoder();
    const propertyNameBytes = result.propertyNames.map(name => encoder.encode(name));

    let headerSize = 4 + 4 + 2; // totalAtoms + pageCount + propertyCount
    for (const nameBytes of propertyNameBytes) {
        headerSize += 2 + nameBytes.byteLength;
    }

    const pad4 = (offset: number): number => (offset + 3) & ~3;
    const idsStart = pad4(headerSize);
    const typesStart = idsStart + pageCount * Uint32Array.BYTES_PER_ELEMENT;
    const positionsStart = pad4(typesStart + pageCount * Uint16Array.BYTES_PER_ELEMENT);
    const propsStart = positionsStart + pageCount * 3 * Float32Array.BYTES_PER_ELEMENT;
    const totalSize = propsStart + result.propertyNames.length * pageCount * Float32Array.BYTES_PER_ELEMENT;

    const out = new Uint8Array(totalSize);
    const view = new DataView(out.buffer);
    let cursor = 0;

    view.setUint32(cursor, result.totalAtoms, true); cursor += 4;
    view.setUint32(cursor, pageCount, true); cursor += 4;
    view.setUint16(cursor, result.propertyNames.length, true); cursor += 2;

    for (let i = 0; i < result.propertyNames.length; i++) {
        const nameBytes = propertyNameBytes[i];
        view.setUint16(cursor, nameBytes.byteLength, true); cursor += 2;
        out.set(nameBytes, cursor);
        cursor += nameBytes.byteLength;
    }

    new Uint8Array(
        out.buffer,
        idsStart,
        pageCount * Uint32Array.BYTES_PER_ELEMENT
    ).set(new Uint8Array(result.ids.buffer, result.ids.byteOffset, result.ids.byteLength));

    new Uint8Array(
        out.buffer,
        typesStart,
        pageCount * Uint16Array.BYTES_PER_ELEMENT
    ).set(new Uint8Array(result.types.buffer, result.types.byteOffset, result.types.byteLength));

    new Uint8Array(
        out.buffer,
        positionsStart,
        pageCount * 3 * Float32Array.BYTES_PER_ELEMENT
    ).set(new Uint8Array(result.positions.buffer, result.positions.byteOffset, result.positions.byteLength));

    let propCursor = propsStart;
    for (const name of result.propertyNames) {
        const column = result.propsMap[name];
        new Uint8Array(
            out.buffer,
            propCursor,
            column.byteLength
        ).set(new Uint8Array(column.buffer, column.byteOffset, column.byteLength));
        propCursor += pageCount * Float32Array.BYTES_PER_ELEMENT;
    }

    return out;
};
