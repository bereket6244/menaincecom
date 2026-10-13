import path from 'node:path';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const WIDTHS = new Set([320, 640, 960, 1280]);

/** Originals stay untouched; variants are generated once and reused on disk. */
export function imageVariants(uploadsDir, cacheDir) {
  const pending = new Map();
  let active = 0;
  const waiting = [];
  return async (req, res) => {
    const { file, width: rawWidth } = req.query;
    const width = Number(rawWidth);
    if (typeof file !== 'string' || !/^[\w.-]+\.(?:jpe?g|png|webp|avif)$/i.test(file) || !WIDTHS.has(width)) {
      return res.status(400).end();
    }
    const original = path.join(uploadsDir, file);
    try {
      const real = await fs.realpath(original);
      if (path.dirname(real) !== await fs.realpath(uploadsDir)) return res.status(404).end();
      const stat = await fs.stat(real);
      const key = createHash('sha256').update(`${file}:${stat.size}:${stat.mtimeMs}:${width}:v1`).digest('hex');
      const output = path.join(cacheDir, `${key}.webp`);
      try {
        await fs.access(output);
      } catch {
        if (!pending.has(key)) {
          // Keep memory/CPU bounded on shared hosting without falling back to
          // full-size photos for an ordinary row of simultaneous card requests.
          if (pending.size >= 64) throw new Error('Image converter busy');
          const job = (async () => {
            if (active >= 2) await new Promise((resolve) => waiting.push(resolve));
            else active++;
            try {
              await fs.mkdir(cacheDir, { recursive: true });
              const buffer = await sharp(real, { limitInputPixels: 60_000_000 })
                .rotate().resize({ width, withoutEnlargement: true })
                .webp({ quality: 80, effort: 3 }).toBuffer();
              const temporary = `${output}.${process.pid}.tmp`;
              await fs.writeFile(temporary, buffer);
              await fs.rename(temporary, output);
            } finally {
              const next = waiting.shift();
              if (next) next();
              else active--;
            }
          })();
          pending.set(key, job);
          job.finally(() => pending.delete(key)).catch(() => {});
        }
        await pending.get(key);
      }
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
      return res.sendFile(output);
    } catch (error) {
      if (error.code === 'ENOENT') return res.status(404).end();
      // Conversion failure must never break an otherwise valid product photo.
      res.setHeader('Cache-Control', 'no-store');
      return res.redirect(302, `${req.baseUrl.replace(/\/api$/, '')}/uploads/${encodeURIComponent(file)}`);
    }
  };
}
