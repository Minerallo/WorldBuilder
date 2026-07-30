/*
  Copyright (C) 2026 by the authors of the World Builder code.

  Web-only adaptive grid sampling for the browser WebAssembly target.
*/

#include "adaptive_sampler.h"

#include "world_builder/assert.h"
#include "world_builder/consts.h"
#include "world_builder/world.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <deque>
#include <limits>
#include <map>
#include <stdexcept>
#include <tuple>
#include <utility>
#include <vector>

namespace
{
  struct LatticePoint
  {
    std::uint32_t u;
    std::uint32_t v;
    std::uint32_t w;

    bool operator<(const LatticePoint &other) const
    {
      return std::tie(u, v, w) < std::tie(other.u, other.v, other.w);
    }
  };

  struct Cell
  {
    unsigned int level;
    std::uint32_t i;
    std::uint32_t j;
    std::uint32_t k;
  };

  struct Sample
  {
    std::array<double, 3> position = {{0., 0., 0.}};
    double depth_wrt_surface = 0.;
    double depth_wrt_reference = 0.;
    double topography = 0.;
    double temperature = 0.;
    std::array<double, 3> velocity = {{0., 0., 0.}};
    std::int32_t tag = 0;
    double density = 0.;
    std::vector<double> composition;
  };

  std::size_t checked_product(const std::size_t a,
                              const std::size_t b,
                              const char *description)
  {
    if (a != 0 && b > std::numeric_limits<std::size_t>::max() / a)
      throw std::runtime_error(std::string("Adaptive grid is too large: ") +
                               description);
    return a * b;
  }

  class Sampler
  {
    public:
      Sampler(const WorldBuilder::World &world,
              const WorldBuilder::Grid::Config &grid_config,
              const WorldBuilder::Web::AdaptiveConfig &adaptive_config)
        : world(world)
        , grid_config(grid_config)
        , adaptive_config(adaptive_config)
      {
        WBAssertThrow(grid_config.dimension == 2 || grid_config.dimension == 3,
                      "Adaptive browser grids support dimensions 2 and 3.");
        WBAssertThrow(grid_config.type == "cartesian" ||
                      grid_config.type == "chunk",
                      "Adaptive browser grids support cartesian and chunk grids.");
        WBAssertThrow(adaptive_config.base_resolution > 0 &&
                      adaptive_config.base_resolution <= 16,
                      "Adaptive base resolution must be between 1 and 16.");
        WBAssertThrow(adaptive_config.max_depth <= 10,
                      "Adaptive maximum depth must not exceed 10.");
        WBAssertThrow(adaptive_config.max_cells > 0,
                      "Adaptive maximum cell count must be positive.");
        WBAssertThrow(adaptive_config.temperature_tolerance >= 0. &&
                      adaptive_config.composition_tolerance >= 0. &&
                      adaptive_config.topography_tolerance >= 0.,
                      "Adaptive tolerances must not be negative.");

        // Keep one extra binary lattice level so that the centres of the
        // prospective child cells are exact cache keys. Those probes allow
        // narrow features to trigger refinement even when the parent corners
        // and centre all happen to lie outside the feature.
        const std::uint64_t scale =
          static_cast<std::uint64_t>(adaptive_config.base_resolution)
          << (adaptive_config.max_depth + 1);
        WBAssertThrow(scale <= std::numeric_limits<std::uint32_t>::max(),
                      "Adaptive lattice resolution exceeds 32-bit limits.");
        lattice_scale = static_cast<std::uint32_t>(scale);

        properties.push_back({{1, 0, 0}});
        properties.push_back({{5, 0, 0}});
        properties.push_back({{4, 0, 0}});
        if (grid_config.output_density)
          properties.push_back({{7, 0, 0}});
        for (unsigned int composition = 0;
             composition < grid_config.compositions;
             ++composition)
          properties.push_back({{2, composition, 0}});
      }

      WorldBuilder::Web::AdaptiveResult run()
      {
        WorldBuilder::Web::AdaptiveResult output;
        output.base_resolution = adaptive_config.base_resolution;

        std::deque<Cell> pending;
        const unsigned int base_y =
          grid_config.dimension == 3 ? adaptive_config.base_resolution : 1;
        for (unsigned int k = 0; k < adaptive_config.base_resolution; ++k)
          for (unsigned int j = 0; j < base_y; ++j)
            for (unsigned int i = 0; i < adaptive_config.base_resolution; ++i)
              pending.push_back({0, i, j, k});

        std::size_t prospective_leaf_count = pending.size();
        WBAssertThrow(prospective_leaf_count <= adaptive_config.max_cells,
                      "Adaptive maximum cell count is smaller than the base grid.");

        std::vector<Cell> leaves;
        while (!pending.empty())
          {
            const Cell cell = pending.front();
            pending.pop_front();
            output.maximum_level = std::max(output.maximum_level, cell.level);

            const unsigned int children =
              grid_config.dimension == 3 ? 8 : 4;
            const bool wants_refinement =
              cell.level < adaptive_config.max_depth && should_refine(cell);
            const bool has_budget =
              prospective_leaf_count <= adaptive_config.max_cells &&
              children - 1 <=
              adaptive_config.max_cells - prospective_leaf_count;

            if (wants_refinement && has_budget)
              {
                prospective_leaf_count += children - 1;
                for (unsigned int dk = 0; dk < 2; ++dk)
                  for (unsigned int dj = 0;
                       dj < (grid_config.dimension == 3 ? 2u : 1u);
                       ++dj)
                    for (unsigned int di = 0; di < 2; ++di)
                      pending.push_back({
                        cell.level + 1,
                        2 * cell.i + di,
                        grid_config.dimension == 3 ? 2 * cell.j + dj : 0,
                        2 * cell.k + dk
                      });
              }
            else
              {
                if (wants_refinement)
                  output.cell_limit_reached = true;
                leaves.push_back(cell);
              }
          }

        assemble(leaves, output);
        return output;
      }

    private:
      const WorldBuilder::World &world;
      const WorldBuilder::Grid::Config &grid_config;
      const WorldBuilder::Web::AdaptiveConfig &adaptive_config;
      std::uint32_t lattice_scale = 0;
      std::vector<std::array<unsigned int, 3>> properties;
      std::map<LatticePoint, Sample> sample_cache;

      std::uint32_t cell_step(const unsigned int level) const
      {
        return static_cast<std::uint32_t>(1u <<
                                          (adaptive_config.max_depth -
                                           level + 1));
      }

      std::array<LatticePoint, 8> corners(const Cell &cell) const
      {
        const std::uint32_t step = cell_step(cell.level);
        const std::uint32_t u0 = cell.i * step;
        const std::uint32_t v0 =
          grid_config.dimension == 3 ? cell.j * step : 0;
        const std::uint32_t w0 = cell.k * step;
        if (grid_config.dimension == 2)
          return {{
            {u0,        0, w0},
            {u0 + step, 0, w0},
            {u0 + step, 0, w0 + step},
            {u0,        0, w0 + step},
            {0, 0, 0},
            {0, 0, 0},
            {0, 0, 0},
            {0, 0, 0}
          }};

        const std::uint32_t v1 =
          v0 + step;

        return {{
          {u0,        v0, w0},
          {u0 + step, v0, w0},
          {u0 + step, v1, w0},
          {u0,        v1, w0},
          {u0,        v0, w0 + step},
          {u0 + step, v0, w0 + step},
          {u0 + step, v1, w0 + step},
          {u0,        v1, w0 + step}
        }};
      }

      LatticePoint center(const Cell &cell) const
      {
        const std::uint32_t half_step = cell_step(cell.level) / 2;
        return {
          cell.i * cell_step(cell.level) + half_step,
          grid_config.dimension == 3
          ? cell.j * cell_step(cell.level) + half_step
          : 0,
          cell.k * cell_step(cell.level) + half_step
        };
      }

      std::array<std::pair<LatticePoint, std::array<double, 3>>, 8>
      child_centers(const Cell &cell) const
      {
        const std::uint32_t step = cell_step(cell.level);
        const std::uint32_t quarter_step = step / 4;
        std::array<std::pair<LatticePoint, std::array<double, 3>>, 8> points;
        unsigned int index = 0;
        for (unsigned int dk = 0; dk < 2; ++dk)
          for (unsigned int dj = 0;
               dj < (grid_config.dimension == 3 ? 2u : 1u);
               ++dj)
            for (unsigned int di = 0; di < 2; ++di)
              {
                const double u = di == 0 ? .25 : .75;
                const double v =
                  grid_config.dimension == 3 ? (dj == 0 ? .25 : .75) : 0.;
                const double w = dk == 0 ? .25 : .75;
                points[index++] = {
                  {
                    cell.i * step + (2 * di + 1) * quarter_step,
                    grid_config.dimension == 3
                    ? cell.j * step + (2 * dj + 1) * quarter_step
                    : 0,
                    cell.k * step + (2 * dk + 1) * quarter_step
                  },
                  {{u, v, w}}
                };
              }
        return points;
      }

      double interpolate_corner_temperature(
        const std::array<const Sample *, 8> &corner_samples,
        const std::array<double, 3> &position) const
      {
        const double u = position[0];
        const double v = position[1];
        const double w = position[2];
        if (grid_config.dimension == 2)
          return corner_samples[0]->temperature * (1. - u) * (1. - w) +
                 corner_samples[1]->temperature * u * (1. - w) +
                 corner_samples[2]->temperature * u * w +
                 corner_samples[3]->temperature * (1. - u) * w;

        return corner_samples[0]->temperature *
                 (1. - u) * (1. - v) * (1. - w) +
               corner_samples[1]->temperature *
                 u * (1. - v) * (1. - w) +
               corner_samples[2]->temperature *
                 u * v * (1. - w) +
               corner_samples[3]->temperature *
                 (1. - u) * v * (1. - w) +
               corner_samples[4]->temperature *
                 (1. - u) * (1. - v) * w +
               corner_samples[5]->temperature *
                 u * (1. - v) * w +
               corner_samples[6]->temperature * u * v * w +
               corner_samples[7]->temperature *
                 (1. - u) * v * w;
      }

      double topography_at(const unsigned int dimension,
                           const double x,
                           const double y,
                           const double z,
                           const double depth) const
      {
        if (dimension == 2)
          return world.properties(std::array<double, 2>({{x, z}}),
                                  depth,
                                  {{{6, 0, 0}}})[0];
        return world.properties(std::array<double, 3>({{x, y, z}}),
                                depth,
                                {{{6, 0, 0}}})[0];
      }

      Sample evaluate(const LatticePoint &point) const
      {
        const double u = static_cast<double>(point.u) / lattice_scale;
        const double v = grid_config.dimension == 3
                         ? static_cast<double>(point.v) / lattice_scale
                         : 0.;
        const double w = static_cast<double>(point.w) / lattice_scale;
        Sample sample;

        if (grid_config.type == "cartesian")
          {
            const double x =
              grid_config.x_min + u * (grid_config.x_max - grid_config.x_min);
            const double y = grid_config.dimension == 3
                             ? grid_config.y_min +
                               v * (grid_config.y_max - grid_config.y_min)
                             : 0.;
            const double nominal_height =
              grid_config.z_max - grid_config.z_min;
            const double nominal_z = grid_config.z_min + w * nominal_height;
            const double nominal_depth = grid_config.z_max - nominal_z;
            sample.topography =
              topography_at(grid_config.dimension, x, y, nominal_z,
                            nominal_depth);
            const double height = nominal_height + sample.topography;
            sample.position = {{x, y, grid_config.z_min + w * height}};
            sample.depth_wrt_surface = height * (1. - w);
          }
        else
          {
            const double degrees = WorldBuilder::Consts::PI / 180.;
            const double longitude =
              (grid_config.x_min +
               u * (grid_config.x_max - grid_config.x_min)) * degrees;
            const double latitude =
              grid_config.dimension == 3
              ? (grid_config.y_min +
                 v * (grid_config.y_max - grid_config.y_min)) * degrees
              : 0.;
            const double nominal_height =
              grid_config.z_max - grid_config.z_min;
            const double nominal_radius =
              grid_config.z_min + w * nominal_height;
            const double nominal_depth =
              grid_config.z_max - nominal_radius;
            const double cos_latitude = std::cos(latitude);
            const double nominal_x =
              nominal_radius * cos_latitude * std::cos(longitude);
            const double nominal_y =
              nominal_radius * cos_latitude * std::sin(longitude);
            const double nominal_z =
              nominal_radius * std::sin(latitude);
            sample.topography =
              grid_config.dimension == 2
              ? topography_at(2, nominal_x, 0.,
                              nominal_radius * std::sin(longitude),
                              nominal_depth)
              : topography_at(3, nominal_x, nominal_y, nominal_z,
                              nominal_depth);

            const double radius =
              grid_config.z_min + w * (nominal_height + sample.topography);
            const double x =
              radius * cos_latitude * std::cos(longitude);
            const double y =
              radius * cos_latitude * std::sin(longitude);
            const double z = grid_config.dimension == 3
                             ? radius * std::sin(latitude)
                             : radius * std::sin(longitude);
            sample.position = {{
              grid_config.dimension == 2
              ? radius * std::cos(longitude)
              : x,
              grid_config.dimension == 2 ? 0. : y,
              z
            }};
            sample.depth_wrt_surface =
              (nominal_height + sample.topography) * (1. - w);
          }

        sample.depth_wrt_reference =
          sample.depth_wrt_surface - sample.topography;
        const std::vector<double> values =
          grid_config.dimension == 2
          ? world.properties(
              std::array<double, 2>({{sample.position[0],
                                      sample.position[2]}}),
              sample.depth_wrt_surface,
              properties)
          : world.properties(sample.position,
                             sample.depth_wrt_surface,
                             properties);

        std::size_t value = 0;
        sample.temperature = values[value++];
        sample.velocity = {{values[value], values[value + 1],
                            values[value + 2]}};
        value += 3;
        sample.tag = static_cast<std::int32_t>(values[value++]);
        if (grid_config.output_density)
          sample.density = values[value++];
        sample.composition.resize(grid_config.compositions);
        for (unsigned int composition = 0;
             composition < grid_config.compositions;
             ++composition)
          sample.composition[composition] = values[value++];
        return sample;
      }

      const Sample &sample(const LatticePoint &point)
      {
        const auto existing = sample_cache.find(point);
        if (existing != sample_cache.end())
          return existing->second;
        return sample_cache.emplace(point, evaluate(point)).first->second;
      }

      bool should_refine(const Cell &cell)
      {
        const auto points = corners(cell);
        const unsigned int corner_count =
          grid_config.dimension == 3 ? 8 : 4;
        const Sample &middle = sample(center(cell));
        std::array<const Sample *, 8> corner_samples = {{
          nullptr, nullptr, nullptr, nullptr,
          nullptr, nullptr, nullptr, nullptr
        }};

        double interpolated_temperature = 0.;
        double minimum_topography = middle.topography;
        double maximum_topography = middle.topography;
        std::int32_t first_tag = middle.tag;
        bool tag_changes = false;
        std::vector<double> minimum_composition =
          middle.composition;
        std::vector<double> maximum_composition =
          middle.composition;

        for (unsigned int index = 0; index < corner_count; ++index)
          {
            const Sample &corner = sample(points[index]);
            corner_samples[index] = &corner;
            interpolated_temperature += corner.temperature / corner_count;
            minimum_topography =
              std::min(minimum_topography, corner.topography);
            maximum_topography =
              std::max(maximum_topography, corner.topography);
            tag_changes = tag_changes || corner.tag != first_tag;
            for (unsigned int composition = 0;
                 composition < grid_config.compositions;
                 ++composition)
              {
                minimum_composition[composition] =
                  std::min(minimum_composition[composition],
                           corner.composition[composition]);
                maximum_composition[composition] =
                  std::max(maximum_composition[composition],
                           corner.composition[composition]);
              }
          }

        if (std::abs(middle.temperature - interpolated_temperature) >
            adaptive_config.temperature_tolerance)
          return true;

        // Probe the centres of the cells that would be created by the next
        // refinement. This is the feature-tracking stencil: a narrow plate,
        // fault, plume, or sublayer can be invisible at every parent corner
        // and at the parent centre, but still occupy one of these children.
        const auto probes = child_centers(cell);
        const unsigned int probe_count =
          grid_config.dimension == 3 ? 8 : 4;
        for (unsigned int index = 0; index < probe_count; ++index)
          {
            const auto &probe = probes[index];
            const Sample &value = sample(probe.first);
            const double interpolated =
              interpolate_corner_temperature(corner_samples, probe.second);
            if (std::abs(value.temperature - interpolated) >
                adaptive_config.temperature_tolerance)
              return true;
            minimum_topography =
              std::min(minimum_topography, value.topography);
            maximum_topography =
              std::max(maximum_topography, value.topography);
            tag_changes = tag_changes || value.tag != first_tag;
            for (unsigned int composition = 0;
                 composition < grid_config.compositions;
                 ++composition)
              {
                minimum_composition[composition] =
                  std::min(minimum_composition[composition],
                           value.composition[composition]);
                maximum_composition[composition] =
                  std::max(maximum_composition[composition],
                           value.composition[composition]);
              }
          }

        if (maximum_topography - minimum_topography >
            adaptive_config.topography_tolerance)
          return true;
        if (adaptive_config.refine_on_tag_change && tag_changes)
          return true;
        for (unsigned int composition = 0;
             composition < grid_config.compositions;
             ++composition)
          if (maximum_composition[composition] -
              minimum_composition[composition] >
              adaptive_config.composition_tolerance)
            return true;
        return false;
      }

      void assemble(const std::vector<Cell> &leaves,
                    WorldBuilder::Web::AdaptiveResult &output)
      {
        WorldBuilder::Grid::Result &result = output.grid;
        result.dimension = grid_config.dimension;
        result.compositions = grid_config.compositions;
        result.cells = {{grid_config.cells_x,
                         grid_config.cells_y,
                         grid_config.cells_z}};

        std::map<LatticePoint, std::uint32_t> point_indices;
        std::vector<LatticePoint> ordered_points;
        const unsigned int corner_count =
          grid_config.dimension == 3 ? 8 : 4;

        output.cell_bounds.reserve(
          checked_product(leaves.size(), 6, "cell bounds"));
        output.cell_levels.reserve(leaves.size());
        result.connectivity.reserve(
          checked_product(leaves.size(), corner_count, "connectivity"));

        for (const Cell &cell : leaves)
          {
            const auto points = corners(cell);
            const std::uint32_t step = cell_step(cell.level);
            const double inverse_scale = 1. / lattice_scale;
            const double u0 = cell.i * step * inverse_scale;
            const double u1 = (cell.i * step + step) * inverse_scale;
            const double v0 = grid_config.dimension == 3
                              ? cell.j * step * inverse_scale : 0.;
            const double v1 = grid_config.dimension == 3
                              ? (cell.j * step + step) * inverse_scale : 1.;
            const double w0 = cell.k * step * inverse_scale;
            const double w1 = (cell.k * step + step) * inverse_scale;
            output.cell_bounds.insert(output.cell_bounds.end(),
                                      {u0, u1, v0, v1, w0, w1});
            output.cell_levels.push_back(
              static_cast<std::uint8_t>(cell.level));

            for (unsigned int corner = 0; corner < corner_count; ++corner)
              {
                const LatticePoint point = points[corner];
                const auto existing = point_indices.find(point);
                std::uint32_t index;
                if (existing == point_indices.end())
                  {
                    WBAssertThrow(
                      ordered_points.size() <
                      static_cast<std::size_t>(
                        std::numeric_limits<std::uint32_t>::max()),
                      "Adaptive browser grid exceeds 32-bit point limits.");
                    index =
                      static_cast<std::uint32_t>(ordered_points.size());
                    point_indices.emplace(point, index);
                    ordered_points.push_back(point);
                  }
                else
                  index = existing->second;
                result.connectivity.push_back(index);
              }
          }

        const std::size_t point_count = ordered_points.size();
        result.points.reserve(checked_product(point_count, 3,
                                              "point coordinates"));
        result.depth_wrt_surface.reserve(point_count);
        result.depth_wrt_reference.reserve(point_count);
        result.topography.reserve(point_count);
        result.temperature.reserve(point_count);
        result.velocity.reserve(checked_product(point_count, 3,
                                                "velocity values"));
        result.tags.reserve(point_count);
        if (grid_config.output_density)
          result.density.reserve(point_count);
        result.composition.assign(
          checked_product(point_count, grid_config.compositions,
                          "composition values"),
          0.);

        for (std::size_t point = 0; point < point_count; ++point)
          {
            const Sample &value = sample(ordered_points[point]);
            result.points.insert(result.points.end(),
                                 value.position.begin(),
                                 value.position.end());
            result.depth_wrt_surface.push_back(value.depth_wrt_surface);
            result.depth_wrt_reference.push_back(value.depth_wrt_reference);
            result.topography.push_back(value.topography);
            result.temperature.push_back(value.temperature);
            result.velocity.insert(result.velocity.end(),
                                   value.velocity.begin(),
                                   value.velocity.end());
            result.tags.push_back(value.tag);
            if (grid_config.output_density)
              result.density.push_back(value.density);
            for (unsigned int composition = 0;
                 composition < grid_config.compositions;
                 ++composition)
              result.composition[
                static_cast<std::size_t>(composition) * point_count + point] =
                value.composition[composition];
          }
      }
  };
}

namespace WorldBuilder
{
  namespace Web
  {
    std::size_t AdaptiveResult::leaf_count() const
    {
      return cell_levels.size();
    }

    AdaptiveResult sample_adaptive(
      const World &world,
      const Grid::Config &grid_config,
      const AdaptiveConfig &adaptive_config)
    {
      return Sampler(world, grid_config, adaptive_config).run();
    }
  }
}
