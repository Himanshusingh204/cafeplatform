#!/usr/bin/env node
/**
 * Reproducible image optimiser (ROADMAP Phase 6, AUDIT P1-9).
 *
 * The repository shipped 1200x896 JPEGs at 800–970 KB and a 2.8 MB PNG
 * screenshot. Re-encoding is safe, deterministic and lossless in layout terms:
 * dimensions and filenames are preserved so no component or seeded record has
 * to change.
 *
 *   node scripts/optimize-images.mjs            # rewrite assets in place
 *   node scripts/optimize-images.mjs --check    # report only, exit 1 if over budget
 *
 * Budgets (docs/SEO-AND-PERFORMANCE.md §14.2): every image < 200 KB. Source
 * files under public/images/screenshots are documentation captures, not page
 * assets; they get a separate 400 KB ceiling after downscaling.
 *
 * Keep this script dependency-light: `sharp` is already a production dependency
 * because the upload pipeline uses it.
 */
import { readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

// Windows: do not keep input files open/cached after processing.
sharp.cache(false);

const ROOT = path.resolve("public/images");
const CHECK = process.argv.includes("--check");
const PAGE_BUDGET_KB = 200;
const SCREENSHOT_BUDGET_KB = 400;

const RASTER = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

function budgetFor(relativePath) {
  return relativePath.split(path.sep)[0] === "screenshots"
    ? SCREENSHOT_BUDGET_KB
    : PAGE_BUDGET_KB;
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (RASTER.has(path.extname(entry.name).toLowerCase())) files.push(full);
  }
  return files;
}

function kb(bytes) {
  return Math.round((bytes / 1024) * 10) / 10;
}

function encode(pipeline, ext) {
  switch (ext) {
    case ".png":
      return pipeline.png({ compressionLevel: 9, palette: true, quality: 80 });
    case ".webp":
      return pipeline.webp({ quality: 78, effort: 5 });
    case ".avif":
      return pipeline.avif({ quality: 55, effort: 4 });
    default:
      return pipeline.jpeg({ quality: 72, mozjpeg: true, progressive: true });
  }
}

async function main() {
  let files;
  try {
    files = await walk(ROOT);
  } catch {
    console.error(`No image directory at ${ROOT}`);
    process.exit(1);
  }

  const failures = [];
  let beforeTotal = 0;
  let afterTotal = 0;

  for (const file of files) {
    const relative = path.relative(ROOT, file);
    const ext = path.extname(file).toLowerCase();
    const before = (await stat(file)).size;
    const meta = await sharp(file).metadata();
    const budget = budgetFor(relative);

    beforeTotal += before;

    // Preserve aspect ratio; never enlarge an asset.
    const maxWidth = relative.startsWith("screenshots") ? 1440 : 1600;
    const maxHeight = relative.startsWith("screenshots") ? 900 : 1600;

    if (CHECK) {
      const over = kb(before) > budget;
      if (over) failures.push(`${relative}: ${kb(before)} KB > ${budget} KB`);
      afterTotal += before;
      console.log(
        `${over ? "OVER " : "ok   "} ${relative} ${meta.width}x${meta.height} ${kb(before)} KB`
      );
      continue;
    }

    const pipeline = sharp(file)
      .rotate()
      .resize({ width: maxWidth, height: maxHeight, fit: "inside", withoutEnlargement: true });

    const buffer = await encode(pipeline, ext).toBuffer();

    if (buffer.length < before) {
      // Write via fs, not sharp().toFile(): sharp keeps the source file handle
      // open for the lifetime of the pipeline, which fails on Windows when the
      // destination is the same path as the input.
      await writeFile(file, buffer);
    }

    const after = (await stat(file)).size;
    afterTotal += after;
    if (kb(after) > budget) failures.push(`${relative}: ${kb(after)} KB > ${budget} KB`);
    console.log(
      `${relative}: ${meta.width}x${meta.height} ${kb(before)} KB -> ${kb(after)} KB (-${Math.max(
        0,
        Math.round((1 - after / before) * 100)
      )}%)`
    );
  }

  console.log(
    `\nTotal: ${kb(beforeTotal)} KB -> ${kb(afterTotal)} KB` +
      (beforeTotal > 0 ? ` (-${Math.round((1 - afterTotal / beforeTotal) * 100)}%)` : "")
  );

  if (failures.length > 0) {
    console.error(`\n${failures.length} asset(s) over budget:`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
}

await main();
