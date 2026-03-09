#include <node_api.h>
#include <vector>
#include <string>
#include "common.hpp"

struct DataMetadata {
    int atomCount = 0;
    SimulationBox box = {};
    bool isValid = false;
};

static DataMetadata parseDataHeader(const char* RESTRICT data, size_t fileSize) {
    DataMetadata meta;
    
    const char* p = data;
    const char* end = data + fileSize;
    // Only scan first 8KB
    const char* limit = data + (fileSize < 8192 ? fileSize : 8192); 
    
    // Bitmask: 1=atoms, 2=xlo, 4=ylo, 8=zlo
    uint8_t found = 0;
    
    while (p < limit && found != 15) {
        const char* lineEnd = findLineEnd(p, limit);
        const char* content = skipWhitespace(p, lineEnd);
        
        if (UNLIKELY(content >= lineEnd || *content == '#')) {
            p = lineEnd + 1;
            continue;
        }
        
        // Check for "N atoms"
        if (!(found & 1)) {
            const char* tokEnd = findTokenEnd(content, lineEnd);
            const char* keyword = skipWhitespace(tokEnd, lineEnd);
            
            if (keyword + 5 <= lineEnd && strncmp(keyword, "atoms", 5) == 0) {
                meta.atomCount = fastAtoi(content, tokEnd);
                found |= 1;
                p = lineEnd + 1;
                continue;
            }
        }
        
        // Check for box bounds (xlo xhi, ylo yhi, zlo zhi)
        if (lineEnd - content > 4) {
            // Look for "lo" keyword
            const char* loPos = (const char*)memmem(content, lineEnd - content, "lo", 2);
            if (loPos && loPos > content) {
                char axis = *(loPos - 1);
                
                const char* n1 = content;
                const char* n1End = findTokenEnd(n1, lineEnd);
                double lo = fastAtof(n1, n1End);
                
                const char* n2 = skipWhitespace(n1End, lineEnd);
                const char* n2End = findTokenEnd(n2, lineEnd);
                double hi = fastAtof(n2, n2End);
                
                if (axis == 'x' && !(found & 2)) {
                    meta.box.xlo = lo; meta.box.xhi = hi;
                    found |= 2;
                } else if (axis == 'y' && !(found & 4)) {
                    meta.box.ylo = lo; meta.box.yhi = hi;
                    found |= 4;
                } else if (axis == 'z' && !(found & 8)) {
                    meta.box.zlo = lo; meta.box.zhi = hi;
                    found |= 8;
                }
            }
        }
        
        p = lineEnd + 1;
    }
    
    meta.isValid = (found == 15);
    return meta;
}

struct ParseResult {
    BoundingBox bbox;
    int count;
};

HOT static ParseResult parseAtomSection(
    const char* RESTRICT data,
    size_t fileSize,
    int expectedAtoms,
    float* RESTRICT positions,
    uint16_t* RESTRICT types,
    uint32_t* RESTRICT ids
) {
    ParseResult result;
    result.bbox.init();
    result.count = 0;
    
    const char* end = data + fileSize;
    
    // Find "Atoms" section
    const char* atomsMarker = (const char*)memmem(data, fileSize, "Atoms", 5);
    if (UNLIKELY(!atomsMarker)) return result;
    
    // Skip "Atoms" line and blank lines
    const char* p = jumpToNextLine(atomsMarker, end);
    while (p < end) {
        const char* content = skipWhitespace(p, end);
        if (content < end && *content != '\n' && *content != '\r' && *content != '#') break;
        p = jumpToNextLine(p, end);
    }
    
    // Detect column style from first data line
    ColumnMapping cols;
    {
        const char* lineEnd = findLineEnd(p, end);
        int colCount = 0;
        const char* tok = skipWhitespace(p, lineEnd);
        while (tok < lineEnd) {
            colCount++;
            tok = findTokenEnd(tok, lineEnd);
            tok = skipWhitespace(tok, lineEnd);
        }
        detectDataColumnStyle(colCount, cols);
    }
    
    const int maxCol = cols.maxIdx;
    int atomIdx = 0;
    
    // Parse atoms
    while (p < end && atomIdx < expectedAtoms) {
        const char* lineEnd = findLineEnd(p, end);
        const char* content = skipWhitespace(p, lineEnd);
        
        // Skip empty/comment lines
        if (UNLIKELY(content >= lineEnd || *content == '#')) {
            p = lineEnd + 1;
            continue;
        }
        
        // Stop at section headers (capital letter start)
        if (UNLIKELY(*content >= 'A' && *content <= 'Z')) break;
        
        // Parse line
        float x = 0, y = 0, z = 0;
        int type = 0;
        uint32_t id = 0;
        
        const char* tok = content;
        int col = 0;
        
        while (tok < lineEnd && col <= maxCol) {
            const char* tokEnd = findTokenEnd(tok, lineEnd);
            
            if (col == cols.idxX) {
                x = (float)fastAtof(tok, tokEnd);
            } else if (col == cols.idxY) {
                y = (float)fastAtof(tok, tokEnd);
            } else if (col == cols.idxZ) {
                z = (float)fastAtof(tok, tokEnd);
            } else if (col == cols.idxType) {
                type = fastAtoi(tok, tokEnd);
            } else if (ids && col == cols.idxId) {
                id = (uint32_t)fastAtoi(tok, tokEnd);
            }
            
            tok = skipWhitespace(tokEnd, lineEnd);
            col++;
        }
        
        // Write to output
        int posIdx = atomIdx * 3;
        positions[posIdx] = x;
        positions[posIdx + 1] = y;
        positions[posIdx + 2] = z;
        types[atomIdx] = (uint16_t)type;
        if (ids) ids[atomIdx] = id;
        
        result.bbox.update(x, y, z);
        atomIdx++;
        p = lineEnd + 1;
    }
    
    result.count = atomIdx;
    return result;
}

static napi_value ParseData(napi_env env, napi_callback_info info) {
    size_t argc = 2;
    napi_value args[2];
    napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
    
    // Get filepath
    size_t pathLen;
    napi_get_value_string_utf8(env, args[0], nullptr, 0, &pathLen);
    std::string filepath(pathLen, '\0');
    napi_get_value_string_utf8(env, args[0], &filepath[0], pathLen + 1, &pathLen);
    
    // Get options
    bool includeIds = false;
    if (argc >= 2) {
        napi_value optionsObj = args[1];
        napi_valuetype type;
        napi_typeof(env, optionsObj, &type);
        if (type == napi_object) {
            napi_value val;
            if (napi_get_named_property(env, optionsObj, "includeIds", &val) == napi_ok) {
                napi_get_value_bool(env, val, &includeIds);
            }
        }
    }
    
    // Memory-map file
    MappedFile file = mapFile(filepath.c_str());
    if (!file.valid) {
        napi_throw_error(env, nullptr, "Failed to open file");
        return nullptr;
    }
    
    // Parse header
    DataMetadata meta = parseDataHeader(file.data, file.size);
    
    if (!meta.isValid) {
        unmapFile(file);
        napi_throw_error(env, nullptr, "Invalid LAMMPS data format");
        return nullptr;
    }
    
    // Create output arrays (zero-copy allocation in V8 heap)
    napi_value posBuffer, typesBuffer, idsBuffer = nullptr;
    void *posPtr, *typesPtr, *idsPtr = nullptr;
    napi_value posArray, typesArray, idsArray;
    
    napi_create_arraybuffer(env, (size_t)meta.atomCount * 3 * sizeof(float), &posPtr, &posBuffer);
    napi_create_typedarray(env, napi_float32_array, (size_t)meta.atomCount * 3, posBuffer, 0, &posArray);
    
    napi_create_arraybuffer(env, (size_t)meta.atomCount * sizeof(uint16_t), &typesPtr, &typesBuffer);
    napi_create_typedarray(env, napi_uint16_array, (size_t)meta.atomCount, typesBuffer, 0, &typesArray);
    
    if (includeIds) {
        napi_create_arraybuffer(env, (size_t)meta.atomCount * sizeof(uint32_t), &idsPtr, &idsBuffer);
        napi_create_typedarray(env, napi_uint32_array, (size_t)meta.atomCount, idsBuffer, 0, &idsArray);
    }
    
    // Parse atoms (single-threaded - data files are usually small)
    ParseResult parsed = parseAtomSection(
        file.data, file.size, meta.atomCount,
        (float*)posPtr, (uint16_t*)typesPtr, (uint32_t*)idsPtr
    );
    
    unmapFile(file);
    
    if (parsed.count == 0) {
        napi_throw_error(env, nullptr, "No atoms parsed");
        return nullptr;
    }
    
    // Build result object
    napi_value result;
    napi_create_object(env, &result);
    
    napi_set_named_property(env, result, "positions", posArray);
    napi_set_named_property(env, result, "types", typesArray);
    if (idsPtr) napi_set_named_property(env, result, "ids", idsArray);
    
    // Metadata
    napi_value metaObj, boxObj;
    napi_create_object(env, &metaObj);
    napi_create_object(env, &boxObj);
    
    #define SET_DOUBLE(obj, name, val) { napi_value v; napi_create_double(env, val, &v); napi_set_named_property(env, obj, name, v); }
    #define SET_INT(obj, name, val) { napi_value v; napi_create_int32(env, val, &v); napi_set_named_property(env, obj, name, v); }
    
    SET_DOUBLE(boxObj, "xlo", meta.box.xlo);
    SET_DOUBLE(boxObj, "xhi", meta.box.xhi);
    SET_DOUBLE(boxObj, "ylo", meta.box.ylo);
    SET_DOUBLE(boxObj, "yhi", meta.box.yhi);
    SET_DOUBLE(boxObj, "zlo", meta.box.zlo);
    SET_DOUBLE(boxObj, "zhi", meta.box.zhi);
    
    SET_INT(metaObj, "timestep", 0);
    SET_INT(metaObj, "natoms", parsed.count);
    napi_set_named_property(env, metaObj, "boxBounds", boxObj);
    
    // Empty headers for data files
    napi_value headersArr;
    napi_create_array_with_length(env, 0, &headersArr);
    napi_set_named_property(env, metaObj, "headers", headersArr);
    napi_set_named_property(env, result, "metadata", metaObj);
    
    // Min/max
    napi_value minArr, maxArr;
    napi_create_array_with_length(env, 3, &minArr);
    napi_create_array_with_length(env, 3, &maxArr);
    
    napi_value v;
    napi_create_double(env, parsed.bbox.minX, &v); napi_set_element(env, minArr, 0, v);
    napi_create_double(env, parsed.bbox.minY, &v); napi_set_element(env, minArr, 1, v);
    napi_create_double(env, parsed.bbox.minZ, &v); napi_set_element(env, minArr, 2, v);
    napi_create_double(env, parsed.bbox.maxX, &v); napi_set_element(env, maxArr, 0, v);
    napi_create_double(env, parsed.bbox.maxY, &v); napi_set_element(env, maxArr, 1, v);
    napi_create_double(env, parsed.bbox.maxZ, &v); napi_set_element(env, maxArr, 2, v);
    
    napi_set_named_property(env, result, "min", minArr);
    napi_set_named_property(env, result, "max", maxArr);
    
    #undef SET_DOUBLE
    #undef SET_INT
    
    return result;
}

static napi_value Init(napi_env env, napi_value exports) {
    napi_value fn;
    napi_create_function(env, nullptr, 0, ParseData, nullptr, &fn);
    napi_set_named_property(env, exports, "parseData", fn);
    return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
