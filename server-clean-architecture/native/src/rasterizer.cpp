#include <node_api.h>
#include "rasterizer/rasterizer.h"

namespace NapiBinding {

static std::string napiGetString(napi_env env, napi_value v) {
    size_t len = 0;
    napi_get_value_string_utf8(env, v, nullptr, 0, &len);
    std::string s(len, '\0');
    napi_get_value_string_utf8(env, v, &s[0], len + 1, &len);
    return s;
}

static napi_value Rasterize(napi_env env, napi_callback_info info) {
    size_t argc = 7;
    napi_value args[7];
    napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);

    if(argc < 7){
        napi_value res; 
        napi_get_boolean(env, false, &res); 
        return res;
    }

    std::string glbPath = napiGetString(env, args[0]);
    std::string pngPath = napiGetString(env, args[1]);

    int32_t width = 0, height = 0;
    napi_get_value_int32(env, args[2], &width);
    napi_get_value_int32(env, args[3], &height);

    double az = 0, el = 0;
    napi_get_value_double(env, args[4], &az);
    napi_get_value_double(env, args[5], &el);

    napi_value opts = args[6], v;
    Rasterizer::Options ropts{};
    double fov = ropts.fovDeg, distScale = ropts.distScale;
    bool zUp = ropts.zUp;

    if(napi_get_named_property(env, opts, "fov", &v) == napi_ok) napi_get_value_double(env, v, &fov);
    if(napi_get_named_property(env, opts, "distScale", &v) == napi_ok) napi_get_value_double(env, v, &distScale);
    if(napi_get_named_property(env, opts, "zUp", &v) == napi_ok) napi_get_value_bool(env, v, &zUp);

    ropts.fovDeg = (float)fov;
    ropts.distScale = (float)distScale;
    ropts.zUp = zUp;

    if(width <= 0 || height <= 0){
        napi_value res;
        napi_get_boolean(env, false, &res); 
        return res;
    }

    Rasterizer raster;
    bool ok = raster.rasterize(glbPath.c_str(), pngPath.c_str(),
                               width, height,
                               (float)az, (float)el,
                               ropts);

    napi_value res;
    napi_get_boolean(env, ok, &res);
    return res;
}

static napi_value Init(napi_env env, napi_value exports) {
    napi_value fn;
    napi_create_function(env, nullptr, 0, Rasterize, nullptr, &fn);
    napi_set_named_property(env, exports, "rasterize", fn);
    return exports;
}

} 

NAPI_MODULE(NODE_GYP_MODULE_NAME, NapiBinding::Init)
