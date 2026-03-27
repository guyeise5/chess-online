import type { Response } from "express";

/** SPA shell must not be cached so deploys load fresh script/link tags; hashed assets stay cacheable. */
export const INDEX_HTML_CACHE_CONTROL =
  "no-store, no-cache, must-revalidate, max-age=0";

export function setIndexHtmlNoCacheHeaders(res: Response): void {
  res.setHeader("Cache-Control", INDEX_HTML_CACHE_CONTROL);
  res.setHeader("Pragma", "no-cache");
}
