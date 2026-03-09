#include <node_api.h>
#include <cmath>
#include <set>
#include <vector>
#include <algorithm>
#include "common.hpp"

struct StatsResult {
    double min = 1e300;
    double max = -1e300;
};

HOT static StatsResult getStatsForProperty(const char* RESTRICT filepath, int propIdx) {
    StatsResult result;
    
    MappedFile file = mapFile(filepath);
    if (!file.valid) return result;
    
    const char* end = file.data + file.size;
    
    // Find ITEM: ATOMS
    const char* atomsMarker = (const char*)memmem(file.data, file.size, "ITEM: ATOMS", 11);
    if (UNLIKELY(!atomsMarker)) {
        unmapFile(file);
        return result;
    }
    
    // Skip header line
    const char* p = jumpToNextLine(atomsMarker, end);
    
    // Process lines
    while (p < end) {
        const char* lineEnd = findLineEnd(p, end);
        const char* content = skipWhitespace(p, lineEnd);
        
        // Check for next ITEM: section
        if (UNLIKELY(content[0] == 'I' && lineEnd - content >= 5 && content[4] == ':')) {
            break;
        }
        
        // Parse fields to find target property
        int fieldIdx = 0;
        const char* tok = content;
        
        while (tok < lineEnd) {
            const char* tokEnd = findTokenEnd(tok, lineEnd);
            
            if (fieldIdx == propIdx) {
                double val = fastAtof(tok, tokEnd);
                if (val < result.min) result.min = val;
                if (val > result.max) result.max = val;
                break;
            }
            
            fieldIdx++;
            tok = skipWhitespace(tokEnd, lineEnd);
        }
        
        p = lineEnd + 1;
    }
    
    unmapFile(file);
    
    if (result.min > 1e299) result.min = 0;
    if (result.max < -1e299) result.max = 0;
    
    return result;
}

template<typename T>
HOT static void computeMinMax(T* RESTRICT data, size_t length, double& min, double& max) {
    min = 1e300;
    max = -1e300;
    
    size_t i = 0;
    
    // Unrolled loop (4x)
    for (; i + 4 <= length; i += 4) {
        double v0 = (double)data[i];
        double v1 = (double)data[i + 1];
        double v2 = (double)data[i + 2];
        double v3 = (double)data[i + 3];
        
        if (v0 < min) min = v0;
        if (v0 > max) max = v0;
        if (v1 < min) min = v1;
        if (v1 > max) max = v1;
        if (v2 < min) min = v2;
        if (v2 > max) max = v2;
        if (v3 < min) min = v3;
        if (v3 > max) max = v3;
    }
    
    // Remainder
    for (; i < length; i++) {
        double v = (double)data[i];
        if (v < min) min = v;
        if (v > max) max = v;
    }
    
    if (min > 1e299) min = 0;
    if (max < -1e299) max = 0;
}

static napi_value GetStatsForProperty(napi_env env, napi_callback_info info) {
    size_t argc = 2;
    napi_value args[2];
    napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
    
    // Get filepath
    size_t pathLen;
    napi_get_value_string_utf8(env, args[0], nullptr, 0, &pathLen);
    char filepath[pathLen + 1];
    napi_get_value_string_utf8(env, args[0], filepath, pathLen + 1, &pathLen);
    
    // Get property index
    int32_t propIdx;
    napi_get_value_int32(env, args[1], &propIdx);
    
    StatsResult stats = getStatsForProperty(filepath, propIdx);
    
    napi_value result;
    napi_create_object(env, &result);
    
    napi_value minVal, maxVal;
    napi_create_double(env, stats.min, &minVal);
    napi_create_double(env, stats.max, &maxVal);
    napi_set_named_property(env, result, "min", minVal);
    napi_set_named_property(env, result, "max", maxVal);
    
    return result;
}

static napi_value GetMinMaxFromTypedArray(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value args[1];
    napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
    
    bool isTypedArray;
    napi_is_typedarray(env, args[0], &isTypedArray);
    
    if (!isTypedArray) {
        napi_value undefined;
        napi_get_undefined(env, &undefined);
        return undefined;
    }
    
    napi_typedarray_type type;
    size_t length;
    void* data;
    napi_value arraybuffer;
    size_t offset;
    napi_get_typedarray_info(env, args[0], &type, &length, &data, &arraybuffer, &offset);
    
    double min, max;
    
    switch (type) {
        case napi_float32_array:
            computeMinMax((float*)data, length, min, max);
            break;
        case napi_float64_array:
            computeMinMax((double*)data, length, min, max);
            break;
        case napi_int32_array:
            computeMinMax((int32_t*)data, length, min, max);
            break;
        case napi_uint32_array:
            computeMinMax((uint32_t*)data, length, min, max);
            break;
        default:
            min = max = 0;
    }
    
    napi_value result;
    napi_create_object(env, &result);
    
    napi_value minVal, maxVal;
    napi_create_double(env, min, &minVal);
    napi_create_double(env, max, &maxVal);
    napi_set_named_property(env, result, "min", minVal);
    napi_set_named_property(env, result, "max", maxVal);
    
    return result;
}

static napi_value ComputeMagnitudes(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value args[1];
    napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
    
    bool isArray;
    napi_is_array(env, args[0], &isArray);
    if (!isArray) {
        napi_value undefined;
        napi_get_undefined(env, &undefined);
        return undefined;
    }
    
    uint32_t length;
    napi_get_array_length(env, args[0], &length);
    
    if (length == 0) {
        napi_value buf, arr;
        void* data;
        napi_create_arraybuffer(env, 0, &data, &buf);
        napi_create_typedarray(env, napi_float32_array, 0, buf, 0, &arr);
        return arr;
    }
    
    // Allocate output
    napi_value outBuffer, outArray;
    void* outData;
    napi_create_arraybuffer(env, length * sizeof(float), &outData, &outBuffer);
    float* magnitudes = (float*)outData;
    
    for (uint32_t i = 0; i < length; i++) {
        napi_value element;
        napi_get_element(env, args[0], i, &element);
        
        bool isTypedArray;
        napi_is_typedarray(env, element, &isTypedArray);
        
        double sum = 0.0;
        
        if (isTypedArray) {
            napi_typedarray_type type;
            size_t vecLen;
            void* vecData;
            napi_value ab;
            size_t offset;
            napi_get_typedarray_info(env, element, &type, &vecLen, &vecData, &ab, &offset);
            
            if (type == napi_float32_array) {
                float* fdata = (float*)vecData;
                for (size_t j = 0; j < vecLen; j++) {
                    sum += fdata[j] * fdata[j];
                }
            } else if (type == napi_float64_array) {
                double* ddata = (double*)vecData;
                for (size_t j = 0; j < vecLen; j++) {
                    sum += ddata[j] * ddata[j];
                }
            }
        } else {
            bool isJsArray;
            napi_is_array(env, element, &isJsArray);
            if (isJsArray) {
                uint32_t vecLen;
                napi_get_array_length(env, element, &vecLen);
                for (uint32_t j = 0; j < vecLen; j++) {
                    napi_value val;
                    napi_get_element(env, element, j, &val);
                    double num;
                    napi_get_value_double(env, val, &num);
                    sum += num * num;
                }
            }
        }
        
        magnitudes[i] = (float)sqrt(sum);
    }
    
    napi_create_typedarray(env, napi_float32_array, length, outBuffer, 0, &outArray);
    return outArray;
}

HOT static std::vector<double> getUniqueValuesForProperty(const char* RESTRICT filepath, int propIdx, int maxValues) {
    std::set<double> uniqueSet;
    
    MappedFile file = mapFile(filepath);
    if (!file.valid) return {};
    
    const char* end = file.data + file.size;
    
    const char* atomsMarker = (const char*)memmem(file.data, file.size, "ITEM: ATOMS", 11);
    if (UNLIKELY(!atomsMarker)) {
        unmapFile(file);
        return {};
    }
    
    const char* p = jumpToNextLine(atomsMarker, end);
    
    while (p < end && (maxValues <= 0 || (int)uniqueSet.size() < maxValues)) {
        const char* lineEnd = findLineEnd(p, end);
        const char* content = skipWhitespace(p, lineEnd);
        
        if (UNLIKELY(content[0] == 'I' && lineEnd - content >= 5 && content[4] == ':')) {
            break;
        }
        
        int fieldIdx = 0;
        const char* tok = content;
        
        while (tok < lineEnd) {
            const char* tokEnd = findTokenEnd(tok, lineEnd);
            
            if (fieldIdx == propIdx) {
                double val = fastAtof(tok, tokEnd);
                uniqueSet.insert(val);
                break;
            }
            
            fieldIdx++;
            tok = skipWhitespace(tokEnd, lineEnd);
        }
        
        p = lineEnd + 1;
    }
    
    unmapFile(file);
    
    std::vector<double> result(uniqueSet.begin(), uniqueSet.end());
    std::sort(result.begin(), result.end());
    
    if (maxValues > 0 && (int)result.size() > maxValues) {
        result.resize(maxValues);
    }
    
    return result;
}

static napi_value GetUniqueValuesForProperty(napi_env env, napi_callback_info info) {
    size_t argc = 3;
    napi_value args[3];
    napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
    
    size_t pathLen;
    napi_get_value_string_utf8(env, args[0], nullptr, 0, &pathLen);
    char filepath[pathLen + 1];
    napi_get_value_string_utf8(env, args[0], filepath, pathLen + 1, &pathLen);
    
    int32_t propIdx;
    napi_get_value_int32(env, args[1], &propIdx);
    
    int32_t maxValues = 100;
    if (argc >= 3) {
        napi_get_value_int32(env, args[2], &maxValues);
    }
    
    std::vector<double> uniqueValues = getUniqueValuesForProperty(filepath, propIdx, maxValues);
    
    napi_value result;
    napi_create_array_with_length(env, uniqueValues.size(), &result);
    
    for (size_t i = 0; i < uniqueValues.size(); i++) {
        napi_value val;
        napi_create_double(env, uniqueValues[i], &val);
        napi_set_element(env, result, i, val);
    }
    
    return result;
}

static napi_value Init(napi_env env, napi_value exports) {
    napi_value fn1, fn2, fn3, fn4;
    
    napi_create_function(env, nullptr, 0, GetStatsForProperty, nullptr, &fn1);
    napi_set_named_property(env, exports, "getStatsForProperty", fn1);
    
    napi_create_function(env, nullptr, 0, GetMinMaxFromTypedArray, nullptr, &fn2);
    napi_set_named_property(env, exports, "getMinMaxFromTypedArray", fn2);
    
    napi_create_function(env, nullptr, 0, ComputeMagnitudes, nullptr, &fn3);
    napi_set_named_property(env, exports, "computeMagnitudes", fn3);
    
    napi_create_function(env, nullptr, 0, GetUniqueValuesForProperty, nullptr, &fn4);
    napi_set_named_property(env, exports, "getUniqueValuesForProperty", fn4);
    
    return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
