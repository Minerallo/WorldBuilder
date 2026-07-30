/*
  Copyright (C) 2026 by the authors of the World Builder code.

  Web-only adaptive grid sampling for the browser WebAssembly target.
*/

#ifndef GWB_WEB_ADAPTIVE_SAMPLER_H
#define GWB_WEB_ADAPTIVE_SAMPLER_H

#include "world_builder/grid_sampler.h"

#include <cstddef>
#include <cstdint>
#include <vector>

namespace WorldBuilder
{
  class World;

  namespace Web
  {
    struct AdaptiveConfig
    {
      unsigned int base_resolution = 4;
      unsigned int max_depth = 4;
      std::size_t max_cells = 100000;
      double temperature_tolerance = 25.;
      double composition_tolerance = 0.05;
      double topography_tolerance = 250.;
      bool refine_on_tag_change = true;
    };

    struct AdaptiveResult
    {
      Grid::Result grid;

      // Normalized logical bounds [u0,u1,v0,v1,w0,w1] for every leaf.
      // In 2D, v spans [0,1] and is not refined.
      std::vector<double> cell_bounds;
      std::vector<std::uint8_t> cell_levels;

      unsigned int base_resolution = 0;
      unsigned int maximum_level = 0;
      bool cell_limit_reached = false;

      std::size_t leaf_count() const;
    };

    AdaptiveResult sample_adaptive(const World &world,
                                   const Grid::Config &grid_config,
                                   const AdaptiveConfig &adaptive_config);
  }
}

#endif
