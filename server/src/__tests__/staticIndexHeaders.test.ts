import type { Response } from "express";
import {
  INDEX_HTML_CACHE_CONTROL,
  setIndexHtmlNoCacheHeaders,
} from "../staticIndexHeaders";

describe("staticIndexHeaders", () => {
  it("setIndexHtmlNoCacheHeaders sets Cache-Control and Pragma", () => {
    const headers = new Map<string, string>();
    const res = {
      setHeader(name: string, value: string | number | readonly string[]) {
        headers.set(
          name.toLowerCase(),
          Array.isArray(value) ? value.join(", ") : String(value),
        );
      },
    } as Pick<Response, "setHeader"> as Response;

    setIndexHtmlNoCacheHeaders(res);

    expect(headers.get("cache-control")).toBe(INDEX_HTML_CACHE_CONTROL);
    expect(headers.get("pragma")).toBe("no-cache");
  });
});
