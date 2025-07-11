#include <pybind11/pybind11.h>
#include <spdlog/spdlog.h>
#include <fmt/core.h>
#include <opendxa_py/bindings/module.hpp> 
#include <opendxa_py/bindings/python_sink.hpp>

namespace py = pybind11;
using namespace OpenDXA::Bindings::Python;

template <typename Mutex>
PythonSink<Mutex>::PythonSink(py::object py_logger)
  : _py_logger(std::move(py_logger))
{}

template <typename Mutex>
void PythonSink<Mutex>::sink_it_(const spdlog::details::log_msg &msg) {
    py::gil_scoped_acquire G;
    spdlog::memory_buf_t formatted;
    this->formatter_->format(msg, formatted);
    _py_logger.attr("info")(fmt::to_string(formatted));
}

template <typename Mutex>
void PythonSink<Mutex>::flush_() {}

template class PythonSink<std::mutex>;

namespace OpenDXA::Bindings::Python {

void bindLogging(py::module &m) {
    auto py_logging = py::module::import("logging");
    auto py_logger  = py_logging.attr("getLogger")("opendxa");
    py_logger.attr("setLevel")(py_logging.attr("DEBUG"));

    auto sink       = std::make_shared<python_sink_mt>(py_logger);
    auto spd_logger = std::make_shared<spdlog::logger>("opendxa_spdlog", sink);
    spd_logger->set_level(spdlog::level::debug);
    spdlog::set_default_logger(spd_logger);

    spdlog::set_pattern("[%Y-%m-%d %H:%M:%S.%e] [%l] %v");

    m.def("set_level", [](std::string lvl) {
        auto level = spdlog::level::from_str(lvl);
        spdlog::default_logger()->set_level(level);
    }, "Change the spdlog level (e.g., 'info','debug','warn')");

    m.def("set_pattern", [](std::string pattern) {
        spdlog::set_pattern(pattern);
    }, "Change the spdlog output pattern (fmt format)");
}

}
