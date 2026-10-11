/** 极简静态文件服务（零依赖） */
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
};

export async function serveStatic(rootDir, urlPath) {
  if (!rootDir) return null;
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  const full = join(rootDir, normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  try {
    const st = await stat(full);
    if (st.isDirectory()) {
      const idx = join(full, 'index.html');
      const st2 = await stat(idx);
      if (st2.isFile()) return { body: await readFile(idx), type: 'text/html; charset=utf-8' };
      return null;
    }
    const body = await readFile(full);
    return { body, type: MIME[extname(full).toLowerCase()] || 'application/octet-stream' };
  } catch {
    return null;
  }
}

/** SPA fallback：找不到文件时回退 index.html */
export async function serveSpa(rootDir, urlPath) {
  const hit = await serveStatic(rootDir, urlPath);
  if (hit) return hit;
  try {
    const body = await readFile(join(rootDir, 'index.html'));
    return { body, type: 'text/html; charset=utf-8' };
  } catch {
    return null;
  }
}
