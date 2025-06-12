#ifndef OPENDXA_PYTHON_COMMON_UTILS_HPP
#define OPENDXA_PYTHON_COMMON_UTILS_HPP

#include <string>
#include <opendxa/logger/logger.hpp>

namespace OpenDXA::Bindings::Python::Utils{

LogLevel stringToLogLevel(const std::string &level);
std::string logLevelToString(LogLevel level);

};

#endif