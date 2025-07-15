#include <napi.h>
#include <opendxa/core/dislocation_analysis.h>
#include <opendxa/core/lammps_parser.h>
#include <nlohmann/json.hpp>
#include <filesystem>
#include <stdexcept>

using json = nlohmann::json;
using namespace OpenDXA;

// Global analyzer instance
static DislocationAnalysis globalAnalyzer;

// Static wrapper functions
Napi::Value SetMaxTrialCircuitSize(const Napi::CallbackInfo& info){
    Napi::Env env = info.Env();
    
    if(info.Length() < 1 || !info[0].IsNumber()){
        Napi::TypeError::New(env, "Expected number argument").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    double circuitSize = info[0].As<Napi::Number>().DoubleValue();
    globalAnalyzer.setMaxTrialCircuitSize(circuitSize);
    
    return env.Undefined();
}

Napi::Value SetCircuitStretchability(const Napi::CallbackInfo& info){
    Napi::Env env = info.Env();
    
    if(info.Length() < 1 || !info[0].IsNumber()){
        Napi::TypeError::New(env, "Expected number argument").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    double stretchability = info[0].As<Napi::Number>().DoubleValue();
    globalAnalyzer.setCircuitStretchability(stretchability);
    
    return env.Undefined();
}

Napi::Value SetOnlyPerfectDislocations(const Napi::CallbackInfo& info){
    Napi::Env env = info.Env();
    
    if(info.Length() < 1 || !info[0].IsBoolean()){
        Napi::TypeError::New(env, "Expected boolean argument").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    bool onlyPerfect = info[0].As<Napi::Boolean>().Value();
    globalAnalyzer.setOnlyPerfectDislocations(onlyPerfect);
    
    return env.Undefined();
}

Napi::Value SetMarkCoreAtoms(const Napi::CallbackInfo& info){
    Napi::Env env = info.Env();
    
    if(info.Length() < 1 || !info[0].IsBoolean()){
        Napi::TypeError::New(env, "Expected boolean argument").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    bool markCore = info[0].As<Napi::Boolean>().Value();
    globalAnalyzer.setMarkCoreAtoms(markCore);
    
    return env.Undefined();
}

Napi::Value SetLineSmoothingLevel(const Napi::CallbackInfo& info){
    Napi::Env env = info.Env();
    
    if(info.Length() < 1 || !info[0].IsNumber()){
        Napi::TypeError::New(env, "Expected number argument").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    double smoothingLevel = info[0].As<Napi::Number>().DoubleValue();
    globalAnalyzer.setLineSmoothingLevel(smoothingLevel);
    
    return env.Undefined();
}

Napi::Value SetLinePointInterval(const Napi::CallbackInfo& info){
    Napi::Env env = info.Env();
    
    if(info.Length() < 1 || !info[0].IsNumber()){
        Napi::TypeError::New(env, "Expected number argument").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    double pointInterval = info[0].As<Napi::Number>().DoubleValue();
    globalAnalyzer.setLinePointInterval(pointInterval);
    
    return env.Undefined();
}

Napi::Value SetDefectMeshSmoothingLevel(const Napi::CallbackInfo& info){
    Napi::Env env = info.Env();
    
    if(info.Length() < 1 || !info[0].IsNumber()){
        Napi::TypeError::New(env, "Expected number argument").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    double smoothingLevel = info[0].As<Napi::Number>().DoubleValue();
    globalAnalyzer.setDefectMeshSmoothingLevel(smoothingLevel);
    
    return env.Undefined();
}

Napi::Value SetCrystalStructure(const Napi::CallbackInfo& info){
    Napi::Env env = info.Env();
    
    if(info.Length() < 1 || !info[0].IsNumber()){
        Napi::TypeError::New(env, "Expected number argument").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    int structure = info[0].As<Napi::Number>().Int32Value();
    globalAnalyzer.setInputCrystalStructure(static_cast<LatticeStructureType>(structure));
    
    return env.Undefined();
}

Napi::Value SetIdentificationMode(const Napi::CallbackInfo& info){
    Napi::Env env = info.Env();
    
    if(info.Length() < 1 || !info[0].IsNumber()){
        Napi::TypeError::New(env, "Expected number argument").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    int mode = info[0].As<Napi::Number>().Int32Value();
    globalAnalyzer.setIdentificationMode(static_cast<StructureAnalysis::Mode>(mode));
    
    return env.Undefined();
}

Napi::Value Compute(const Napi::CallbackInfo& info){
    Napi::Env env = info.Env();
    
    if(info.Length() < 1 || !info[0].IsString()){
        Napi::TypeError::New(env, "Expected string argument for input file").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    std::string inputFile = info[0].As<Napi::String>().Utf8Value();
    std::string outputFile = info.Length() > 1 && info[1].IsString() ? 
        info[1].As<Napi::String>().Utf8Value() : "";
    
    try {
        if(inputFile.empty()){
            throw std::invalid_argument("Input file path cannot be empty");
        }
        
        if(!std::filesystem::exists(inputFile)){
            throw std::runtime_error("Input file does not exist: " + inputFile);
        }
        
        LammpsParser parser;
        LammpsParser::Frame frame;
        if(!parser.parseFile(inputFile, frame)){
            throw std::runtime_error("Failed to parse input file: " + inputFile);
        }
        
        json result = globalAnalyzer.compute(frame, outputFile);
        
        // Convert JSON to Napi::Object
        Napi::Object napiResult = Napi::Object::New(env);
        
        for (auto& [key, value] : result.items()){
            if(value.is_string()){
                napiResult.Set(key, Napi::String::New(env, value.get<std::string>()));
            }else if(value.is_number_integer()){
                napiResult.Set(key, Napi::Number::New(env, value.get<int>()));
            }else if(value.is_number_float()){
                napiResult.Set(key, Napi::Number::New(env, value.get<double>()));
            }else if(value.is_boolean()){
                napiResult.Set(key, Napi::Boolean::New(env, value.get<bool>()));
            }
        }
        
        return napiResult;
        
    }catch (const std::exception& e){
        Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        return env.Undefined();
    }
}

// Initialize the odule
Napi::Object Init(Napi::Env env, Napi::Object exports){
    // Export functions
    exports.Set("compute", Napi::Function::New(env, Compute));
    exports.Set("setMaxTrialCircuitSize", Napi::Function::New(env, SetMaxTrialCircuitSize));
    exports.Set("setCircuitStretchability", Napi::Function::New(env, SetCircuitStretchability));
    exports.Set("setOnlyPerfectDislocations", Napi::Function::New(env, SetOnlyPerfectDislocations));
    exports.Set("setMarkCoreAtoms", Napi::Function::New(env, SetMarkCoreAtoms));
    exports.Set("setLineSmoothingLevel", Napi::Function::New(env, SetLineSmoothingLevel));
    exports.Set("setLinePointInterval", Napi::Function::New(env, SetLinePointInterval));
    exports.Set("setDefectMeshSmoothingLevel", Napi::Function::New(env, SetDefectMeshSmoothingLevel));
    exports.Set("setCrystalStructure", Napi::Function::New(env, SetCrystalStructure));
    exports.Set("setIdentificationMode", Napi::Function::New(env, SetIdentificationMode));
    
    // Export constants
    Napi::Object latticeStructure = Napi::Object::New(env);
    latticeStructure.Set("FCC", Napi::Number::New(env, LATTICE_FCC));
    latticeStructure.Set("BCC", Napi::Number::New(env, LATTICE_BCC));
    latticeStructure.Set("HCP", Napi::Number::New(env, LATTICE_HCP));
    exports.Set("LatticeStructure", latticeStructure);
    
    Napi::Object identificationMode = Napi::Object::New(env);
    identificationMode.Set("PTM", Napi::Number::New(env, StructureAnalysis::PTM));
    identificationMode.Set("CNA", Napi::Number::New(env, StructureAnalysis::CNA));
    exports.Set("IdentificationMode", identificationMode);
    
    return exports;
}

NODE_API_MODULE(opendxa_fixed, Init)