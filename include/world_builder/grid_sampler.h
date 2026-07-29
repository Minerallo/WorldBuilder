/*
  Copyright (C) 2026 by the authors of the World Builder code.

  This file is part of the World Builder.

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Lesser General Public License as published
  by the Free Software Foundation, either version 2 of the License, or
  (at your option) any later version.
*/

#ifndef WORLD_BUILDER_GRID_SAMPLER_H
#define WORLD_BUILDER_GRID_SAMPLER_H

#include <array>
#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

namespace WorldBuilder
{
  class World;

  namespace Grid
  {
    /**
     * Browser-friendly subset of the gwb-grid configuration.
     *
     * The sampler intentionally owns no file or VTK concerns. It produces
     * contiguous arrays that can be consumed by native applications,
     * WebAssembly bindings, or visualization libraries.
     */
    struct Config
    {
      std::string type = "cartesian";
      unsigned int dimension = 2;
      unsigned int compositions = 0;
      bool output_density = false;

      double x_min = 0.;
      double x_max = 0.;
      double y_min = 0.;
      double y_max = 0.;
      double z_min = 0.;
      double z_max = 0.;

      unsigned int cells_x = 0;
      unsigned int cells_y = 0;
      unsigned int cells_z = 0;
    };

    struct Result
    {
      unsigned int dimension = 2;
      unsigned int compositions = 0;
      std::array<unsigned int, 3> cells = {{0, 0, 0}};

      // XYZ coordinates are always interleaved, including for 2D grids.
      std::vector<double> points;
      std::vector<std::uint32_t> connectivity;

      std::vector<double> depth_wrt_surface;
      std::vector<double> depth_wrt_reference;
      std::vector<double> topography;
      std::vector<double> temperature;
      std::vector<double> velocity;
      std::vector<std::int32_t> tags;
      std::vector<double> density;

      // Composition-major layout: [composition][point].
      std::vector<double> composition;

      std::size_t point_count() const;
      std::size_t cell_count() const;
      unsigned int vertices_per_cell() const;
    };

    Config parse_config(const std::string &grid_text,
                        unsigned int resolution_limit = 256);

    Result sample(const World &world, const Config &config);
  }
}

#endif
