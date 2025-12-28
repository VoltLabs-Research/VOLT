type Primitive = string | number | boolean | null | undefined | Date;
type QueryValue = Primitive | Primitive[] | Record<string, any>;

export function objectToSearchParams(
  obj: Record<string, QueryValue> | undefined,
  opts?: { arrayFormat?: "repeat" | "comma"; nested?: "brackets" | "dot" }
): URLSearchParams {
  const sp = new URLSearchParams();
  if (!obj) return sp;

  const arrayFormat = opts?.arrayFormat ?? "repeat";
  const nested = opts?.nested ?? "brackets";

  const add = (key: string, value: any) => {
    if (value === undefined || value === null) return;

    if (value instanceof Date) {
      sp.append(key, value.toISOString());
      return;
    }

    if (Array.isArray(value)) {
      if (arrayFormat === "comma") {
        const v = value
          .filter((x) => x !== undefined && x !== null)
          .map((x) => (x instanceof Date ? x.toISOString() : String(x)))
          .join(",");
        if (v) sp.append(key, v);
      } else {
        for (const item of value) add(key, item);
      }
      return;
    }

    if (typeof value === "object") {
      for (const [k, v] of Object.entries(value)) {
        const nextKey = nested === "dot" ? `${key}.${k}` : `${key}[${k}]`;
        add(nextKey, v);
      }
      return;
    }

    sp.append(key, String(value));
  };

  for (const [k, v] of Object.entries(obj)) add(k, v);
  return sp;
}

export function appendSearchParams(url: string, params?: URLSearchParams) {
  if (!params) return url;
  const qs = params.toString();
  if (!qs) return url;
  return url.includes("?") ? `${url}&${qs}` : `${url}?${qs}`;
}
