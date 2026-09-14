import { MAX_PAYLOAD_BYTES } from "./contracts";
import { canonical } from "./crypto";
import { TemplateError } from "./errors";

export type JsonObject = Record<string, unknown>;
export function object(v: unknown): v is JsonObject {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
function depth(v: unknown, level = 0) {
  if (level > 40) throw new TemplateError("INVALID_PAYLOAD", 422, "Template nesting is too deep.");
  if (Array.isArray(v)) {
    for (const x of v) depth(x, level + 1);
  } else if (object(v)) {
    for (const [key, x] of Object.entries(v)) {
      if (["__proto__", "prototype", "constructor"].includes(key)) throw new TemplateError("INVALID_PAYLOAD", 422);
      depth(x, level + 1);
    }
  }
}
export function parsePayload(bytes: Uint8Array, visibility: "public" | "private" | null): JsonObject {
  if (bytes.byteLength > MAX_PAYLOAD_BYTES) throw new TemplateError("PAYLOAD_TOO_LARGE", 413);
  let v: unknown;
  try {
    v = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new TemplateError("INVALID_PAYLOAD", 422);
  }
  depth(v);
  if (
    !object(v) ||
    !object(v.watermarkModel) ||
    !Array.isArray(v.watermarkModel.items) ||
    v.watermarkModel.items.length > 500 ||
    !v.watermarkModel.items.every(object)
  )
    throw new TemplateError("INVALID_PAYLOAD", 422);
  if (v.schemaVersion != null && v.schemaVersion !== 1) throw new TemplateError("UNSUPPORTED_SCHEMA", 422);
  if (visibility === "public") delete v.itemHistories;
  if (visibility === "private" && v.itemHistories != null) {
    if (!object(v.itemHistories)) throw new TemplateError("INVALID_PAYLOAD", 422);
    const basicIDs = new Set([1, 2, 3, 4, 5, 6, 7, 300, 600, 60003]);
    const editableIDs = new Set(
      v.watermarkModel.items.filter((item) => !basicIDs.has(Number(item.id))).map((item) => String(item.id)),
    );
    for (const [id, pack] of Object.entries(v.itemHistories)) {
      if (!editableIDs.has(id) || !object(pack)) throw new TemplateError("INVALID_PAYLOAD", 422);
      for (const key of ["title", "content"]) {
        const entries = pack[key];
        if (entries == null) continue;
        if (
          !Array.isArray(entries) ||
          entries.length > 20 ||
          entries.some(
            (entry) =>
              !object(entry) ||
              (entry.text != null && typeof entry.text !== "string") ||
              (entry.isFavorite != null && typeof entry.isFavorite !== "boolean"),
          )
        )
          throw new TemplateError("INVALID_PAYLOAD", 422);
      }
    }
  }
  return v;
}
// Only renderer-owned resource fields are traversed. URLs in notes and other
// user-authored text are never fetched or rewritten.
export function imageFields(payload: JsonObject) {
  const fields: { parent: JsonObject; key: string; kind: "cover" | "logo" }[] = [
    { parent: payload, key: "coverUrl", kind: "cover" },
  ];
  const model = payload.watermarkModel;
  if (!object(model) || !Array.isArray(model.items)) return fields;
  for (const item of model.items) {
    if (!object(item)) continue;
    for (const key of ["logoInfo", "extraLogo"])
      if (object(item[key])) fields.push({ parent: item[key], key: "logoUrl", kind: "logo" });
    for (const key of ["logoListInfo", "extraLogoListInfo"]) {
      const list = item[key];
      if (object(list) && Array.isArray(list.logoList))
        for (const logo of list.logoList) if (object(logo)) fields.push({ parent: logo, key: "logoUrl", kind: "logo" });
    }
  }
  return fields;
}
export async function mapImages(payload: JsonObject, map: (url: string, kind: "cover" | "logo") => Promise<string>) {
  for (const field of imageFields(payload)) {
    const value = field.parent[field.key];
    if (value == null || value === "") continue;
    if (typeof value !== "string" || value.length > 2048) throw new TemplateError("RESOURCE_INVALID", 422);
    field.parent[field.key] = await map(value, field.kind);
  }
  return payload;
}
export const payloadBytes = (payload: unknown) => Buffer.from(canonical(payload), "utf8");
