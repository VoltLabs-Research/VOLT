// dump_parser.cpp - Ultra-optimized LAMMPS dump parser with multi-threading
#include <node_api.h>
#include <vector>
#include <string>
#include <thread>
#include <future>
#include "common.hpp"

// ============================================================================
// DUMP FILE METADATA
// ============================================================================

struct DumpMetadata {
    int timestep = 0;
    int atomCount = 0;
    SimulationBox box = {};
    std::vector<std::string> headers;
    bool isValid = false;
    const char* atomsSectionPtr = nullptr;
};

// ============================================================================
// HEADER PARSING
// ============================================================================

static DumpMetadata parseDumpHeader(const char* RESTRICT data, size_t fileSize, ColumnMapping& cols) {
    DumpMetadata meta;
    
    const char* p = data;
    const char* end = data + fileSize;
    
    uint8_t found = 0; // Bitmask: 1=timestep, 2=natoms, 4=bounds, 8=atoms
    
    while (p < end && found != 15) {
        const char* lineEnd = findLineEnd(p, end);
        const char* content = skipWhitespace(p, lineEnd);
        
        if (UNLIKELY(content >= lineEnd)) {
            p = lineEnd + 1;
            continue;
        }
        
        // Fast check for "ITEM:" prefix (first 5 chars)
        if (lineEnd - content >= 5 && content[0] == 'I' && content[4] == ':') {
            content += 6; // Skip "ITEM: "
            
            if (!(found & 1) && strncmp(content, "TIMESTEP", 8) == 0) {
                p = lineEnd + 1;
                const char* valEnd = findLineEnd(p, end);
                meta.timestep = fastAtoi(skipWhitespace(p, valEnd), valEnd);
                found |= 1;
                p = valEnd;
            }
            else if (!(found & 2) && strncmp(content, "NUMBER OF ATOMS", 15) == 0) {
                p = lineEnd + 1;
                const char* valEnd = findLineEnd(p, end);
                meta.atomCount = fastAtoi(skipWhitespace(p, valEnd), valEnd);
                found |= 2;
                p = valEnd;
            }
            else if (!(found & 4) && strncmp(content, "BOX BOUNDS", 10) == 0) {
                // Parse 3 lines of box bounds
                for (int i = 0; i < 3 && p < end; i++) {
                    p = lineEnd + 1;
                    lineEnd = findLineEnd(p, end);
                    
                    const char* bp = skipWhitespace(p, lineEnd);
                    const char* tokEnd = findTokenEnd(bp, lineEnd);
                    double lo = fastAtof(bp, tokEnd);
                    
                    bp = skipWhitespace(tokEnd, lineEnd);
                    tokEnd = findTokenEnd(bp, lineEnd);
                    double hi = fastAtof(bp, tokEnd);
                    
                    if (i == 0) { meta.box.xlo = lo; meta.box.xhi = hi; }
                    else if (i == 1) { meta.box.ylo = lo; meta.box.yhi = hi; }
                    else { meta.box.zlo = lo; meta.box.zhi = hi; }
                }
                found |= 4;
            }
            else if (!(found & 8) && strncmp(content, "ATOMS", 5) == 0) {
                // Parse column headers
                const char* hp = content + 5;
                hp = skipWhitespace(hp, lineEnd);
                
                int colIdx = 0;
                while (hp < lineEnd) {
                    const char* tokEnd = findTokenEnd(hp, lineEnd);
                    size_t len = tokEnd - hp;
                    
                    // Inline lowercase comparison for speed
                    char c0 = (hp[0] >= 'A' && hp[0] <= 'Z') ? hp[0] + 32 : hp[0];
                    
                    if (len == 4 && c0 == 't' && hp[1] == 'y') {
                        cols.idxType = colIdx;
                    } else if (len == 2 && c0 == 'i' && hp[1] == 'd') {
                        cols.idxId = colIdx;
                    } else if (len >= 1 && len <= 2) {
                        if (c0 == 'x') cols.idxX = colIdx;
                        else if (c0 == 'y') cols.idxY = colIdx;
                        else if (c0 == 'z') cols.idxZ = colIdx;
                    }
                    
                    // Store header for API
                    std::string hdr(hp, len);
                    for (char& c : hdr) if (c >= 'A' && c <= 'Z') c += 32;
                    meta.headers.push_back(std::move(hdr));
                    
                    hp = skipWhitespace(tokEnd, lineEnd);
                    colIdx++;
                }
                
                cols.computeMaxIdx();
                meta.atomsSectionPtr = lineEnd + 1;
                found |= 8;
            }
        }
        
        p = lineEnd + 1;
    }
    
    meta.isValid = (found == 15) && cols.idxType >= 0 && cols.idxX >= 0 && cols.idxY >= 0 && cols.idxZ >= 0;
    return meta;
}

struct WorkerResult {
    BoundingBox bbox;
    int count = 0;
};

HOT static void parseChunk(
    const char* RESTRICT chunkStart,
    const char* RESTRICT chunkEnd,
    const char* RESTRICT globalEnd,
    float* RESTRICT positions,
    uint16_t* RESTRICT types,
    uint32_t* RESTRICT ids,
    int startIdx,
    const ColumnMapping& cols,
    WorkerResult* result
) {
    const char* p = chunkStart;
    int atomIdx = startIdx;
    BoundingBox bbox;
    bbox.init();
    
    const int maxCol = cols.maxIdx;
    
    while (p < chunkEnd) {
        const char* lineEnd = findLineEnd(p, globalEnd);
        const char* content = skipWhitespace(p, lineEnd);
        
        // Skip empty lines
        if (UNLIKELY(content >= lineEnd)) {
            p = lineEnd + 1;
            continue;
        }
        
        // Stop at next ITEM: section
        if (UNLIKELY(content[0] == 'I' && lineEnd - content >= 5 && content[4] == ':')) {
            break;
        }
        
        // Parse atom data
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
        
        // Write directly to output buffers (zero-copy)
        int posIdx = atomIdx * 3;
        positions[posIdx] = x;
        positions[posIdx + 1] = y;
        positions[posIdx + 2] = z;
        types[atomIdx] = (uint16_t)type;
        if (ids) ids[atomIdx] = id;
        
        bbox.update(x, y, z);
        atomIdx++;
        p = lineEnd + 1;
    }
    
    result->bbox = bbox;
    result->count = atomIdx - startIdx;
}

// Count atoms in a chunk (for offset calculation)
static int countAtomsInChunk(const char* start, const char* end, const char* globalEnd) {
    int count = 0;
    const char* p = start;
    
    while (p < end) {
        const char* lineEnd = findLineEnd(p, globalEnd);
        const char* content = skipWhitespace(p, lineEnd);
        
        if (content < lineEnd) {
            if (UNLIKELY(content[0] == 'I' && lineEnd - content >= 5 && content[4] == ':')) break;
            count++;
        }
        p = lineEnd + 1;
    }
    
    return count;
}

static napi_value ParseDump(napi_env env, napi_callback_info info) {
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
    ColumnMapping cols;
    DumpMetadata meta = parseDumpHeader(file.data, file.size, cols);
    
    if (!meta.isValid || !meta.atomsSectionPtr) {
        unmapFile(file);
        napi_throw_error(env, nullptr, "Invalid LAMMPS dump format");
        return nullptr;
    }
    
    // Create output arrays (direct allocation in V8 heap - zero copy to JS)
    napi_value posBuffer, typesBuffer, idsBuffer = nullptr;
    void *posPtr, *typesPtr, *idsPtr = nullptr;
    napi_value posArray, typesArray, idsArray;
    
    napi_create_arraybuffer(env, (size_t)meta.atomCount * 3 * sizeof(float), &posPtr, &posBuffer);
    napi_create_typedarray(env, napi_float32_array, (size_t)meta.atomCount * 3, posBuffer, 0, &posArray);
    
    napi_create_arraybuffer(env, (size_t)meta.atomCount * sizeof(uint16_t), &typesPtr, &typesBuffer);
    napi_create_typedarray(env, napi_uint16_array, (size_t)meta.atomCount, typesBuffer, 0, &typesArray);
    
    if (includeIds && cols.idxId >= 0) {
        napi_create_arraybuffer(env, (size_t)meta.atomCount * sizeof(uint32_t), &idsPtr, &idsBuffer);
        napi_create_typedarray(env, napi_uint32_array, (size_t)meta.atomCount, idsBuffer, 0, &idsArray);
    }
    
    // Multi-threaded parsing
    const char* dataStart = meta.atomsSectionPtr;
    const char* dataEnd = file.data + file.size;
    
    unsigned int numThreads = std::thread::hardware_concurrency();
    if (numThreads == 0) numThreads = 1;
    if (meta.atomCount < 50000) numThreads = 1; // Overhead not worth it for small files
    
    std::vector<WorkerResult> results(numThreads);
    
    if (numThreads == 1) {
        // Single-threaded fast path
        parseChunk(dataStart, dataEnd, dataEnd, 
                   (float*)posPtr, (uint16_t*)typesPtr, (uint32_t*)idsPtr,
                   0, cols, &results[0]);
    } else {
        // Split work across threads
        size_t chunkSize = (dataEnd - dataStart) / numThreads;
        std::vector<const char*> chunkPtrs(numThreads + 1);
        chunkPtrs[0] = dataStart;
        chunkPtrs[numThreads] = dataEnd;
        
        for (unsigned int i = 1; i < numThreads; i++) {
            const char* split = dataStart + i * chunkSize;
            chunkPtrs[i] = jumpToNextLine(split, dataEnd);
        }
        
        // Count atoms per chunk to get correct offsets
        std::vector<std::future<int>> countFutures;
        for (unsigned int i = 0; i < numThreads; i++) {
            countFutures.push_back(std::async(std::launch::async,
                countAtomsInChunk, chunkPtrs[i], chunkPtrs[i+1], dataEnd));
        }
        
        std::vector<int> offsets(numThreads, 0);
        int running = 0;
        for (unsigned int i = 0; i < numThreads; i++) {
            offsets[i] = running;
            running += countFutures[i].get();
        }
        
        // Launch workers
        std::vector<std::thread> threads;
        for (unsigned int i = 0; i < numThreads; i++) {
            threads.emplace_back(parseChunk,
                chunkPtrs[i], chunkPtrs[i+1], dataEnd,
                (float*)posPtr, (uint16_t*)typesPtr, (uint32_t*)idsPtr,
                offsets[i], cols, &results[i]);
        }
        for (auto& t : threads) t.join();
    }
    
    // Merge bounding boxes
    BoundingBox globalBbox;
    globalBbox.init();
    for (const auto& r : results) {
        if (r.count > 0) globalBbox.merge(r.bbox);
    }
    
    unmapFile(file);
    
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
    
    SET_INT(metaObj, "timestep", meta.timestep);
    SET_INT(metaObj, "natoms", meta.atomCount);
    napi_set_named_property(env, metaObj, "boxBounds", boxObj);
    
    // Headers
    napi_value headersArr;
    napi_create_array_with_length(env, meta.headers.size(), &headersArr);
    for (size_t i = 0; i < meta.headers.size(); i++) {
        napi_value str;
        napi_create_string_utf8(env, meta.headers[i].c_str(), meta.headers[i].size(), &str);
        napi_set_element(env, headersArr, i, str);
    }
    napi_set_named_property(env, metaObj, "headers", headersArr);
    napi_set_named_property(env, result, "metadata", metaObj);
    
    // Min/max
    napi_value minArr, maxArr;
    napi_create_array_with_length(env, 3, &minArr);
    napi_create_array_with_length(env, 3, &maxArr);
    
    napi_value v;
    napi_create_double(env, globalBbox.minX, &v); napi_set_element(env, minArr, 0, v);
    napi_create_double(env, globalBbox.minY, &v); napi_set_element(env, minArr, 1, v);
    napi_create_double(env, globalBbox.minZ, &v); napi_set_element(env, minArr, 2, v);
    napi_create_double(env, globalBbox.maxX, &v); napi_set_element(env, maxArr, 0, v);
    napi_create_double(env, globalBbox.maxY, &v); napi_set_element(env, maxArr, 1, v);
    napi_create_double(env, globalBbox.maxZ, &v); napi_set_element(env, maxArr, 2, v);
    
    napi_set_named_property(env, result, "min", minArr);
    napi_set_named_property(env, result, "max", maxArr);
    
    #undef SET_DOUBLE
    #undef SET_INT
    
    return result;
}

static napi_value Init(napi_env env, napi_value exports) {
    napi_value fn;
    napi_create_function(env, nullptr, 0, ParseDump, nullptr, &fn);
    napi_set_named_property(env, exports, "parseDump", fn);
    return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
