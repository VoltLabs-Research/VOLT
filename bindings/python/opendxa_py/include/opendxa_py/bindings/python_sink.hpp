#ifndef OPENDXA_PYTHON_PYTHON_SINK_HPP
#define OPENDXA_PYTHON_PYTHON_SINK_HPP

#include <pybind11/pybind11.h>
#include <spdlog/sinks/base_sink.h>
#include <mutex>

namespace OpenDXA::Bindings::Python {

template <typename Mutex>
class PythonSink final : public spdlog::sinks::base_sink<Mutex> {
public:
    explicit PythonSink(pybind11::object py_logger);
protected:
    void sink_it_(const spdlog::details::log_msg &msg) override;
    void flush_() override;
private:
    pybind11::object _py_logger;
};

using python_sink_mt = PythonSink<std::mutex>;

} 

#endif 
