import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { extname, join, relative, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const guiRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const sources = [
  { dir: "doc/sphinx/_static/gwb_input_files", category: "Official tutorial" },
  { dir: "cookbooks", category: "Cookbook" },
  { dir: "tests/gwb-grid", category: "Grid examples" },
  { dir: "tests/gwb-dat", category: "Feature examples" },
  { dir: "tests/data", category: "Reference models" }
];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target));
    else files.push(target);
  }
  return files;
}

function titleFromFilename(filename) {
  return basename(filename, extname(filename))
    .replace(/^BST_\d+_/, "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

const catalog = [];
for (const source of sources) {
  const directory = join(repoRoot, source.dir);
  for (const filename of await walk(directory)) {
    if (extname(filename) !== ".wb") continue;
    try {
      const text = await readFile(filename, "utf8");
      const world = JSON.parse(text);
      if (!Array.isArray(world.features)) continue;
      const gridCandidate = join(dirname(filename), `${basename(filename, ".wb")}.grid`);
      let grid = "";
      try { grid = await readFile(gridCandidate, "utf8"); } catch {}
      const models = [...new Set(world.features.map(feature => feature.model).filter(Boolean))];
      catalog.push({
        id: relative(repoRoot, filename).replaceAll("/", "__"),
        title: titleFromFilename(filename),
        category: source.category,
        source: relative(repoRoot, filename),
        coordinateSystem: world["coordinate system"]?.model || "cartesian",
        featureCount: world.features.length,
        models,
        world,
        grid
      });
    } catch {}
  }
}

catalog.sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
await mkdir(join(guiRoot, "examples"), { recursive: true });
await writeFile(join(guiRoot, "examples/catalog.json"), `${JSON.stringify(catalog)}\n`);
console.log(`Prepared ${catalog.length} World Builder examples.`);
