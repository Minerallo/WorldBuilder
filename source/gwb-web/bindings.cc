/*
  Copyright (C) 2026 by the authors of the World Builder code.

  WebAssembly bindings for browser-side World Builder sampling.
*/

#include "world_builder/grid_sampler.h"
#include "world_builder/world.h"

#include <emscripten/bind.h>

#include <atomic>
#include <cstdio>
#include <fstream>
#include <memory>
#include <stdexcept>
#include <string>
#include <vector>

namespace
{
  template <typename Number>
  emscripten::val copy_typed_array(const char *constructor,
                                   const std::vector<Number> &values)
  {
    const emscripten::val view =
      emscripten::val(emscripten::typed_memory_view(values.size(),
                                                    values.data()));
    return emscripten::val::global(constructor).new_(view);
  }

  emscripten::val copy_cells(const std::array<unsigned int, 3> &cells)
  {
    emscripten::val result = emscripten::val::array();
    result.call<void>("push", cells[0]);
    result.call<void>("push", cells[1]);
    result.call<void>("push", cells[2]);
    return result;
  }

  class BrowserSession
  {
    public:
      explicit BrowserSession(const std::string &world_builder_text)
      {
        static std::atomic<unsigned int> next_id(1);
        model_path = "/gwb-browser-model-" +
                     std::to_string(next_id.fetch_add(1)) + ".wb";

        std::ofstream model(model_path);
        if (!model)
          throw std::runtime_error("Could not create the in-memory GWB model.");
        model << world_builder_text;
        model.close();

        try
          {
            world.reset(new WorldBuilder::World(model_path));
          }
        catch (...)
          {
            std::remove(model_path.c_str());
            throw;
          }
      }

      ~BrowserSession()
      {
        world.reset();
        std::remove(model_path.c_str());
      }

      emscripten::val sample_grid(const std::string &grid_text,
                                  const unsigned int resolution_limit)
      {
        const WorldBuilder::Grid::Config config =
          WorldBuilder::Grid::parse_config(grid_text, resolution_limit);
        const WorldBuilder::Grid::Result result =
          WorldBuilder::Grid::sample(*world, config);

        emscripten::val output = emscripten::val::object();
        output.set("dimension", result.dimension);
        output.set("compositionCount", result.compositions);
        output.set("cells", copy_cells(result.cells));
        output.set("points", copy_typed_array("Float64Array", result.points));
        output.set("connectivity",
                   copy_typed_array("Uint32Array", result.connectivity));
        output.set("depthWrtSurface",
                   copy_typed_array("Float64Array",
                                    result.depth_wrt_surface));
        output.set("depthWrtReference",
                   copy_typed_array("Float64Array",
                                    result.depth_wrt_reference));
        output.set("topography",
                   copy_typed_array("Float64Array", result.topography));
        output.set("temperature",
                   copy_typed_array("Float64Array", result.temperature));
        output.set("velocity",
                   copy_typed_array("Float64Array", result.velocity));
        output.set("tags", copy_typed_array("Int32Array", result.tags));
        output.set("density",
                   copy_typed_array("Float64Array", result.density));
        output.set("composition",
                   copy_typed_array("Float64Array", result.composition));
        return output;
      }

    private:
      std::string model_path;
      std::unique_ptr<WorldBuilder::World> world;
  };
}

EMSCRIPTEN_BINDINGS(gwb_browser)
{
  emscripten::class_<BrowserSession>("BrowserSession")
    .constructor<const std::string &>()
    .function("sampleGrid", &BrowserSession::sample_grid);
}
