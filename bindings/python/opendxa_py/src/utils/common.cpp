#include <opendxa_py/utils/common.hpp>

namespace OpenDXA::Bindings::Python::Utils{

LogLevel stringToLogLevel(const std::string &level){
    if(level == "DEBUG") return LogLevel::DEBUG;
    if(level == "INFO") return LogLevel::INFO;
    if(level == "WARN") return LogLevel::WARN;
    if(level == "ERROR") return LogLevel::ERROR;
    if(level == "FATAL") return LogLevel::FATAL;
    // default
    return LogLevel::INFO;
}

std::string logLevelToString(LogLevel level){
    switch(level){
        case LogLevel::DEBUG: return "DEBUG";
        case LogLevel::INFO: return "INFO";
        case LogLevel::WARN: return "WARN";
        case LogLevel::ERROR: return "ERROR";
        case LogLevel::FATAL: return "FATAL";
        default: return "INFO";
    }
}
    
}