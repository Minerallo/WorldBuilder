/*
  Copyright (C) 2026 by the authors of the World Builder code.

  This file is part of the World Builder.

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Lesser General Public License as published
  by the Free Software Foundation, either version 2 of the License, or
  (at your option) any later version.
*/

#include "world_builder/grid_sampler.h"

#include "world_builder/assert.h"
#include "world_builder/consts.h"
#include "world_builder/world.h"

#include <algorithm>
#include <cmath>
#include <limits>
#include <map>
#include <sstream>
#include <stdexcept>

namespace
{
  std::string trim(const std::string &input)
  {
    const std::string whitespace = " \t\r\n";
    const std::size_t first = input.find_first_not_of(whitespace);
    if (first == std::string::npos)
      return "";
    const std::size_t last = input.find_last_not_of(whitespace);
    return input.substr(first, last - first + 1);
  }

  std::map<std::string, std::string> parse_assignments(const std::string &text)
  {
    std::map<std::string, std::string> values;
    std::istringstream stream(text);
    std::string line;
    while (std::getline(stream, line))
      {
        const std::size_t comment = line.find('#');
        if (comment != std::string::npos)
          line.erase(comment);
        const std::size_t equals = line.find('=');
        if (equals == std::string::npos)
          continue;
        const std::string key = trim(line.substr(0, equals));
        const std::string value = trim(line.substr(equals + 1));
        if (!key.empty() && !value.empty())
          values[key] = value;
      }
    return values;
  }

  double require_double(const std::map<std::string, std::string> &values,
                        const std::string &key)
  {
    const auto entry = values.find(key);
    if (entry == values.end())
      throw std::runtime_error("Missing required grid setting: " + key);
    std::size_t parsed = 0;
    const double value = std::stod(entry->second, &parsed);
    if (parsed != entry->second.size() || !std::isfinite(value))
      throw std::runtime_error("Invalid numeric grid setting: " + key);
    return value;
  }

  unsigned int require_unsigned(const std::map<std::string, std::string> &values,
                                const std::string &key)
  {
    const double value = require_double(values, key);
    if (value < 0. || std::floor(value) != value ||
        value > static_cast<double>(std::numeric_limits<unsigned int>::max()))
      throw std::runtime_error("Invalid unsigned grid setting: " + key);
    return static_cast<unsigned int>(value);
  }

  unsigned int optional_unsigned(const std::map<std::string, std::string> &values,
                                 const std::string &key,
                                 const unsigned int fallback)
  {
    return values.find(key) == values.end() ? fallback : require_unsigned(values, key);
  }

  std::size_t checked_product(const std::size_t a,
                              const std::size_t b,
                              const char *description)
  {
    if (a != 0 && b > std::numeric_limits<std::size_t>::max() / a)
      throw std::runtime_error(std::string("Grid is too large: ") + description);
    return a * b;
  }

  std::size_t point_index(const unsigned int i,
                          const unsigned int j,
                          const unsigned int k,
                          const WorldBuilder::Grid::Config &config)
  {
    const std::size_t nx = static_cast<std::size_t>(config.cells_x) + 1;
    const std::size_t ny = config.dimension == 3
                           ? static_cast<std::size_t>(config.cells_y) + 1
                           : 1;
    return (static_cast<std::size_t>(k) * ny + j) * nx + i;
  }

  void append_point(WorldBuilder::Grid::Result &result,
                    const double x,
                    const double y,
                    const double z,
                    const double depth_surface,
                    const double depth_reference,
                    const double topography)
  {
    result.points.push_back(x);
    result.points.push_back(y);
    result.points.push_back(z);
    result.depth_wrt_surface.push_back(depth_surface);
    result.depth_wrt_reference.push_back(depth_reference);
    result.topography.push_back(topography);
  }

  void add_connectivity(WorldBuilder::Grid::Result &result,
                        const WorldBuilder::Grid::Config &config)
  {
    const std::size_t point_count = result.point_count();
    if (point_count > static_cast<std::size_t>(std::numeric_limits<std::uint32_t>::max()))
      throw std::runtime_error("Browser grid exceeds 32-bit connectivity limits.");

    for (unsigned int k = 0; k < config.cells_z; ++k)
      for (unsigned int j = 0; j < (config.dimension == 3 ? config.cells_y : 1); ++j)
        for (unsigned int i = 0; i < config.cells_x; ++i)
          {
            const auto index = [&] (const unsigned int di,
                                    const unsigned int dj,
                                    const unsigned int dk)
            {
              return static_cast<std::uint32_t>(point_index(i + di, j + dj, k + dk, config));
            };

            if (config.dimension == 2)
              {
                result.connectivity.push_back(index(0, 0, 0));
                result.connectivity.push_back(index(1, 0, 0));
                result.connectivity.push_back(index(1, 0, 1));
                result.connectivity.push_back(index(0, 0, 1));
              }
            else
              {
                result.connectivity.push_back(index(0, 0, 0));
                result.connectivity.push_back(index(1, 0, 0));
                result.connectivity.push_back(index(1, 1, 0));
                result.connectivity.push_back(index(0, 1, 0));
                result.connectivity.push_back(index(0, 0, 1));
                result.connectivity.push_back(index(1, 0, 1));
                result.connectivity.push_back(index(1, 1, 1));
                result.connectivity.push_back(index(0, 1, 1));
              }
          }
  }

  double cartesian_topography(const WorldBuilder::World &world,
                              const unsigned int dimension,
                              const double x,
                              const double y,
                              const double z,
                              const double depth)
  {
    if (dimension == 2)
      return world.properties(std::array<double, 2>({{x, z}}),
                              depth,
                              {{{6, 0, 0}}})[0];
    return world.properties(std::array<double, 3>({{x, y, z}}),
                            depth,
                            {{{6, 0, 0}}})[0];
  }

  void build_cartesian_points(const WorldBuilder::World &world,
                              const WorldBuilder::Grid::Config &config,
                              WorldBuilder::Grid::Result &result)
  {
    const double dx = (config.x_max - config.x_min) / config.cells_x;
    const double dy = config.dimension == 3
                      ? (config.y_max - config.y_min) / config.cells_y
                      : 0.;
    const double nominal_height = config.z_max - config.z_min;

    for (unsigned int k = 0; k <= config.cells_z; ++k)
      for (unsigned int j = 0; j <= (config.dimension == 3 ? config.cells_y : 0); ++j)
        for (unsigned int i = 0; i <= config.cells_x; ++i)
          {
            const double x = config.x_min + i * dx;
            const double y = config.dimension == 3 ? config.y_min + j * dy : 0.;
            const double fraction = static_cast<double>(k) / config.cells_z;
            const double nominal_z = config.z_min + fraction * nominal_height;
            const double nominal_depth = config.z_max - nominal_z;
            const double topography =
              cartesian_topography(world, config.dimension, x, y, nominal_z, nominal_depth);
            const double height = nominal_height + topography;
            const double z = config.z_min + fraction * height;
            const double depth_surface = height * (1. - fraction);
            append_point(result, x, y, z, depth_surface,
                         depth_surface - topography, topography);
          }
  }

  void build_chunk_points(const WorldBuilder::World &world,
                          const WorldBuilder::Grid::Config &config,
                          WorldBuilder::Grid::Result &result)
  {
    const double degrees = WorldBuilder::Consts::PI / 180.;
    const double lon_min = config.x_min * degrees;
    const double lon_step = (config.x_max - config.x_min) * degrees / config.cells_x;
    const double lat_min = config.dimension == 3 ? config.y_min * degrees : 0.;
    const double lat_step = config.dimension == 3
                            ? (config.y_max - config.y_min) * degrees / config.cells_y
                            : 0.;
    const double nominal_height = config.z_max - config.z_min;

    for (unsigned int k = 0; k <= config.cells_z; ++k)
      for (unsigned int j = 0; j <= (config.dimension == 3 ? config.cells_y : 0); ++j)
        for (unsigned int i = 0; i <= config.cells_x; ++i)
          {
            const double longitude = lon_min + i * lon_step;
            const double latitude = lat_min + j * lat_step;
            const double fraction = static_cast<double>(k) / config.cells_z;
            const double nominal_radius = config.z_min + fraction * nominal_height;
            const double nominal_depth = config.z_max - nominal_radius;
            const double cos_latitude = std::cos(latitude);
            const double nominal_x = nominal_radius * cos_latitude * std::cos(longitude);
            const double nominal_y = nominal_radius * cos_latitude * std::sin(longitude);
            const double nominal_z = nominal_radius * std::sin(latitude);

            const double topography =
              config.dimension == 2
              ? cartesian_topography(world, 2, nominal_x, 0.,
                                     nominal_radius * std::sin(longitude),
                                     nominal_depth)
              : cartesian_topography(world, 3, nominal_x, nominal_y,
                                     nominal_z, nominal_depth);
            const double height = nominal_height + topography;
            const double radius = config.z_min + fraction * height;
            const double x = radius * cos_latitude * std::cos(longitude);
            const double y = radius * cos_latitude * std::sin(longitude);
            const double z = config.dimension == 3
                             ? radius * std::sin(latitude)
                             : radius * std::sin(longitude);
            const double x_2d = config.dimension == 2 ? radius * std::cos(longitude) : x;
            const double y_2d = config.dimension == 2 ? 0. : y;
            const double depth_surface = height * (1. - fraction);
            append_point(result, x_2d, y_2d, z, depth_surface,
                         depth_surface - topography, topography);
          }
  }

  void sample_properties(const WorldBuilder::World &world,
                         const WorldBuilder::Grid::Config &config,
                         WorldBuilder::Grid::Result &result)
  {
    std::vector<std::array<unsigned int, 3>> properties;
    properties.push_back({{1, 0, 0}});
    properties.push_back({{5, 0, 0}});
    properties.push_back({{4, 0, 0}});
    if (config.output_density)
      properties.push_back({{7, 0, 0}});
    for (unsigned int composition = 0; composition < config.compositions; ++composition)
      properties.push_back({{2, composition, 0}});

    const std::size_t n_points = result.point_count();
    result.temperature.resize(n_points);
    result.velocity.resize(checked_product(n_points, 3, "velocity values"));
    result.tags.resize(n_points);
    if (config.output_density)
      result.density.resize(n_points);
    result.composition.resize(checked_product(n_points, config.compositions,
                                              "composition values"));

    for (std::size_t point = 0; point < n_points; ++point)
      {
        const double x = result.points[3 * point];
        const double y = result.points[3 * point + 1];
        const double z = result.points[3 * point + 2];
        const std::vector<double> values =
          config.dimension == 2
          ? world.properties(std::array<double, 2>({{x, z}}),
                             result.depth_wrt_surface[point], properties)
          : world.properties(std::array<double, 3>({{x, y, z}}),
                             result.depth_wrt_surface[point], properties);

        std::size_t value = 0;
        result.temperature[point] = values[value++];
        result.velocity[3 * point] = values[value++];
        result.velocity[3 * point + 1] = values[value++];
        result.velocity[3 * point + 2] = values[value++];
        result.tags[point] = static_cast<std::int32_t>(values[value++]);
        if (config.output_density)
          result.density[point] = values[value++];
        for (unsigned int composition = 0; composition < config.compositions; ++composition)
          result.composition[static_cast<std::size_t>(composition) * n_points + point] =
            values[value++];
      }
  }
}

namespace WorldBuilder
{
  namespace Grid
  {
    std::size_t Result::point_count() const
    {
      return points.size() / 3;
    }

    std::size_t Result::cell_count() const
    {
      return connectivity.size() / vertices_per_cell();
    }

    unsigned int Result::vertices_per_cell() const
    {
      return dimension == 2 ? 4 : 8;
    }

    Config parse_config(const std::string &grid_text,
                        const unsigned int resolution_limit)
    {
      WBAssertThrow(resolution_limit > 0, "The browser resolution limit must be positive.");
      const std::map<std::string, std::string> values = parse_assignments(grid_text);

      Config config;
      const auto type = values.find("grid_type");
      if (type != values.end())
        config.type = type->second;
      config.dimension = optional_unsigned(values, "dim", 2);
      config.compositions = optional_unsigned(values, "compositions", 0);
      const auto density = values.find("output_density");
      config.output_density = density != values.end() && density->second == "true";

      config.x_min = require_double(values, "x_min");
      config.x_max = require_double(values, "x_max");
      if (config.dimension == 3)
        {
          config.y_min = require_double(values, "y_min");
          config.y_max = require_double(values, "y_max");
        }
      config.z_min = require_double(values, "z_min");
      config.z_max = require_double(values, "z_max");

      config.cells_x = std::min(require_unsigned(values, "n_cell_x"),
                                resolution_limit);
      config.cells_y = config.dimension == 3
                       ? std::min(require_unsigned(values, "n_cell_y"),
                                  resolution_limit)
                       : 0;
      config.cells_z = std::min(require_unsigned(values, "n_cell_z"),
                                resolution_limit);

      WBAssertThrow(config.dimension == 2 || config.dimension == 3,
                    "Browser grids support dimensions 2 and 3.");
      WBAssertThrow(config.type == "cartesian" || config.type == "chunk",
                    "Browser grids currently support cartesian and chunk grid types.");
      WBAssertThrow(config.cells_x > 0 && config.cells_z > 0 &&
                    (config.dimension == 2 || config.cells_y > 0),
                    "Grid cell counts must be positive.");
      WBAssertThrow(config.x_max > config.x_min && config.z_max > config.z_min,
                    "Grid maximum bounds must be larger than minimum bounds.");
      WBAssertThrow(config.dimension == 2 || config.y_max > config.y_min,
                    "The y maximum bound must be larger than the y minimum bound.");

      return config;
    }

    Result sample(const World &world, const Config &config)
    {
      Result result;
      result.dimension = config.dimension;
      result.compositions = config.compositions;
      result.cells = {{config.cells_x, config.cells_y, config.cells_z}};

      const std::size_t nx = static_cast<std::size_t>(config.cells_x) + 1;
      const std::size_t ny = config.dimension == 3
                             ? static_cast<std::size_t>(config.cells_y) + 1
                             : 1;
      const std::size_t nz = static_cast<std::size_t>(config.cells_z) + 1;
      const std::size_t points = checked_product(checked_product(nx, ny, "points"),
                                                 nz, "points");
      const std::size_t cells = checked_product(
                                  checked_product(config.cells_x,
                                                  config.dimension == 3
                                                  ? config.cells_y : 1,
                                                  "cells"),
                                  config.cells_z, "cells");
      result.points.reserve(checked_product(points, 3, "point coordinates"));
      result.depth_wrt_surface.reserve(points);
      result.depth_wrt_reference.reserve(points);
      result.topography.reserve(points);
      result.connectivity.reserve(checked_product(cells,
                                                   result.vertices_per_cell(),
                                                   "connectivity"));

      if (config.type == "cartesian")
        build_cartesian_points(world, config, result);
      else
        build_chunk_points(world, config, result);

      add_connectivity(result, config);
      sample_properties(world, config, result);
      return result;
    }
  }
}
