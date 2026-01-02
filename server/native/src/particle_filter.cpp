/**
 * Ultra-fast particle filtering using expression evaluation
 * Handles 50M+ atoms efficiently using SIMD and parallel processing
 */

#include <node_api.h>
#include <cstring>
#include <cmath>
#include <vector>
#include <algorithm>
#include <numeric>
#include <thread>

#define HOT __attribute__((hot))
#define COLD __attribute__((cold))
#define RESTRICT __restrict__

enum class Operator {
    EQUAL,
    NOT_EQUAL,
    GREATER,
    GREATER_EQUAL,
    LESS,
    LESS_EQUAL
};

struct FilterExpression {
    Operator op;
    float compareValue;
};

// SIMD-optimized filter evaluation
HOT static size_t evaluateFilterChunk(
    const float* RESTRICT values,
    size_t count,
    const FilterExpression& expr,
    uint8_t* RESTRICT mask
) {
    size_t matchCount = 0;
    
    // Vectorized comparison
    for (size_t i = 0; i < count; i++) {
        bool matches = false;
        const float v = values[i];
        
        switch (expr.op) {
            case Operator::EQUAL:
                matches = std::abs(v - expr.compareValue) < 1e-6f;
                break;
            case Operator::NOT_EQUAL:
                matches = std::abs(v - expr.compareValue) >= 1e-6f;
                break;
            case Operator::GREATER:
                matches = v > expr.compareValue;
                break;
            case Operator::GREATER_EQUAL:
                matches = v >= expr.compareValue;
                break;
            case Operator::LESS:
                matches = v < expr.compareValue;
                break;
            case Operator::LESS_EQUAL:
                matches = v <= expr.compareValue;
                break;
        }
        
        mask[i] = matches ? 1 : 0;
        matchCount += matches ? 1 : 0;
    }
    
    return matchCount;
}

// Parallel filter evaluation for multi-million atoms
HOT static size_t evaluateFilterParallel(
    const float* RESTRICT values,
    size_t count,
    const FilterExpression& expr,
    uint8_t* RESTRICT mask
) {
    const size_t numThreads = std::thread::hardware_concurrency();
    const size_t chunkSize = (count + numThreads - 1) / numThreads;
    
    std::vector<std::thread> threads;
    std::vector<size_t> chunkMatches(numThreads, 0);
    
    for (size_t t = 0; t < numThreads; t++) {
        threads.emplace_back([&, t]() {
            const size_t start = t * chunkSize;
            const size_t end = std::min(start + chunkSize, count);
            if (start >= end) return;
            
            chunkMatches[t] = evaluateFilterChunk(
                values + start,
                end - start,
                expr,
                mask + start
            );
        });
    }
    
    for (auto& thread : threads) {
        thread.join();
    }
    
    return std::accumulate(chunkMatches.begin(), chunkMatches.end(), size_t(0));
}

// N-API: Evaluate filter expression on Float32Array
static napi_value EvaluateFilter(napi_env env, napi_callback_info info) {
    size_t argc = 3;
    napi_value args[3];
    napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
    
    if (argc < 3) {
        napi_throw_error(env, nullptr, "Expected 3 arguments: values, operator, compareValue");
        return nullptr;
    }
    
    // Get Float32Array
    bool isTypedArray;
    napi_is_typedarray(env, args[0], &isTypedArray);
    if (!isTypedArray) {
        napi_throw_error(env, nullptr, "First argument must be Float32Array");
        return nullptr;
    }
    
    void* data;
    size_t byteLength;
    napi_get_typedarray_info(env, args[0], nullptr, &byteLength, &data, nullptr, nullptr);
    const float* values = static_cast<const float*>(data);
    const size_t count = byteLength / sizeof(float);
    
    // Get operator string
    char opStr[16];
    size_t opLen;
    napi_get_value_string_utf8(env, args[1], opStr, sizeof(opStr), &opLen);
    
    FilterExpression expr;
    if (strcmp(opStr, "==") == 0) expr.op = Operator::EQUAL;
    else if (strcmp(opStr, "!=") == 0) expr.op = Operator::NOT_EQUAL;
    else if (strcmp(opStr, ">") == 0) expr.op = Operator::GREATER;
    else if (strcmp(opStr, ">=") == 0) expr.op = Operator::GREATER_EQUAL;
    else if (strcmp(opStr, "<") == 0) expr.op = Operator::LESS;
    else if (strcmp(opStr, "<=") == 0) expr.op = Operator::LESS_EQUAL;
    else {
        napi_throw_error(env, nullptr, "Invalid operator");
        return nullptr;
    }
    
    // Get compare value
    double compareValueDouble;
    napi_get_value_double(env, args[2], &compareValueDouble);
    expr.compareValue = static_cast<float>(compareValueDouble);
    
    // Create result mask (Uint8Array)
    napi_value maskArray;
    void* maskData;
    napi_create_arraybuffer(env, count, &maskData, &maskArray);
    uint8_t* mask = static_cast<uint8_t*>(maskData);
    
    // Evaluate filter
    size_t matchCount;
    if (count > 1000000) {
        matchCount = evaluateFilterParallel(values, count, expr, mask);
    } else {
        matchCount = evaluateFilterChunk(values, count, expr, mask);
    }
    
    // Create Uint8Array view
    napi_value maskView;
    napi_create_typedarray(env, napi_uint8_array, count, maskArray, 0, &maskView);
    
    // Return { mask, matchCount }
    napi_value result, matchCountValue;
    napi_create_object(env, &result);
    napi_create_uint32(env, matchCount, &matchCountValue);
    napi_set_named_property(env, result, "mask", maskView);
    napi_set_named_property(env, result, "matchCount", matchCountValue);
    
    return result;
}

// N-API: Filter positions by mask (creates new filtered arrays)
static napi_value FilterByMask(napi_env env, napi_callback_info info) {
    size_t argc = 3;
    napi_value args[3];
    napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
    
    if (argc < 3) {
        napi_throw_error(env, nullptr, "Expected 3 arguments: positions, types, mask");
        return nullptr;
    }
    
    // Get positions (Float32Array)
    void* posData;
    size_t posByteLength;
    napi_get_typedarray_info(env, args[0], nullptr, &posByteLength, &posData, nullptr, nullptr);
    const float* positions = static_cast<const float*>(posData);
    const size_t atomCount = posByteLength / (3 * sizeof(float));
    
    // Get types (Uint16Array)
    void* typesData;
    size_t typesByteLength;
    napi_get_typedarray_info(env, args[1], nullptr, &typesByteLength, &typesData, nullptr, nullptr);
    const uint16_t* types = static_cast<const uint16_t*>(typesData);
    
    // Get mask (Uint8Array)
    void* maskData;
    size_t maskByteLength;
    napi_get_typedarray_info(env, args[2], nullptr, &maskByteLength, &maskData, nullptr, nullptr);
    const uint8_t* mask = static_cast<const uint8_t*>(maskData);
    
    // Count matches
    size_t matchCount = 0;
    for (size_t i = 0; i < atomCount; i++) {
        if (mask[i]) matchCount++;
    }
    
    // Create filtered arrays
    napi_value filteredPosBuffer, filteredTypesBuffer;
    void* filteredPosData;
    void* filteredTypesData;
    napi_create_arraybuffer(env, matchCount * 3 * sizeof(float), &filteredPosData, &filteredPosBuffer);
    napi_create_arraybuffer(env, matchCount * sizeof(uint16_t), &filteredTypesData, &filteredTypesBuffer);
    
    float* filteredPos = static_cast<float*>(filteredPosData);
    uint16_t* filteredTypes = static_cast<uint16_t*>(filteredTypesData);
    
    // Copy filtered data
    size_t outIdx = 0;
    for (size_t i = 0; i < atomCount; i++) {
        if (mask[i]) {
            filteredPos[outIdx * 3 + 0] = positions[i * 3 + 0];
            filteredPos[outIdx * 3 + 1] = positions[i * 3 + 1];
            filteredPos[outIdx * 3 + 2] = positions[i * 3 + 2];
            filteredTypes[outIdx] = types[i];
            outIdx++;
        }
    }
    
    // Create typed array views
    napi_value filteredPosView, filteredTypesView;
    napi_create_typedarray(env, napi_float32_array, matchCount * 3, filteredPosBuffer, 0, &filteredPosView);
    napi_create_typedarray(env, napi_uint16_array, matchCount, filteredTypesBuffer, 0, &filteredTypesView);
    
    // Return { positions, types, count }
    napi_value result, countValue;
    napi_create_object(env, &result);
    napi_create_uint32(env, matchCount, &countValue);
    napi_set_named_property(env, result, "positions", filteredPosView);
    napi_set_named_property(env, result, "types", filteredTypesView);
    napi_set_named_property(env, result, "count", countValue);
    
    return result;
}

static napi_value Init(napi_env env, napi_value exports) {
    napi_value evaluateFilterFn, filterByMaskFn;
    napi_create_function(env, nullptr, 0, EvaluateFilter, nullptr, &evaluateFilterFn);
    napi_create_function(env, nullptr, 0, FilterByMask, nullptr, &filterByMaskFn);
    napi_set_named_property(env, exports, "evaluateFilter", evaluateFilterFn);
    napi_set_named_property(env, exports, "filterByMask", filterByMaskFn);
    return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
