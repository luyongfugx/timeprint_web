import "server-only";
import { randomUUID, createHmac } from "node:crypto";

import { z } from "zod";

import { database } from "../prisma";

import { byCode, card, checkReadable, detail, ensureSnapshot, normalizeCode } from "./access-service";
import { enabled, secret, shareOrigin } from "./config";
import { listSchema, searchSchema, type TemplateRow } from "./contracts";
import { canonical, equalSecret, sha256 } from "./crypto";
import { TemplateError } from "./errors";
import { rows, write, parseJSON } from "./repository";

export function queryCode(query: string, mode: string): string | null {
  if (mode === "keyword") return null;
  if (/^https?:\/\//i.test(query)) {
    let u: URL;
    try {
      u = new URL(query);
    } catch {
      throw new TemplateError("INVALID_CODE");
    }
    if (
      u.origin !== shareOrigin() ||
      u.pathname !== "/share" ||
      u.username ||
      u.password ||
      u.hash ||
      u.searchParams.getAll("code").length !== 1 ||
      [...u.searchParams.keys()].some((k) => k !== "code")
    )
      throw new TemplateError("INVALID_CODE");
    return normalizeCode(u.searchParams.get("code") ?? "");
  }
  if (mode === "code") return normalizeCode(query);
  const c = query.replace(/\s/g, "").toUpperCase();
  return /^(T[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{9}|[A-F0-9]{8}|(?=[A-Z0-9]{6}$)(?=.*[A-Z])(?=.*[0-9])[A-Z0-9]+)$/.test(
    c,
  )
    ? normalizeCode(c)
    : null;
}
const signature = (s: string) =>
  createHmac("sha256", secret("TEMPLATE_CURSOR_SIGNING_KEY")).update(s).digest("base64url");
export function cursorEncode(snapshot: string, offset: number, hash: string) {
  const data = Buffer.from(JSON.stringify({ snapshot, offset, hash })).toString("base64url");
  return `${data}.${signature(data)}`;
}
export function cursorDecode(cursor: string, hash: string) {
  const [data, sig, extra] = cursor.split(".");
  if (extra || !data || !sig || !equalSecret(signature(data), sig)) throw new TemplateError("INVALID_REQUEST");
  try {
    const parsed = z
      .object({ snapshot: z.string().uuid(), offset: z.number().int().min(0).max(200), hash: z.literal(hash) })
      .strict()
      .parse(JSON.parse(Buffer.from(data, "base64url").toString()));
    return parsed;
  } catch {
    throw new TemplateError("INVALID_REQUEST");
  }
}
export async function publicPage(input: z.infer<typeof listSchema>, query = "", kind = "popular") {
  const excluded = [...new Set(input.excludedTemplateIDs)].sort();
  const hash = sha256(canonical({ query, kind, locale: input.locale, limit: input.limit, excluded }));
  let id: string,
    ids: string[],
    offset = 0;
  if (input.cursor) {
    const cursor = cursorDecode(input.cursor, hash);
    id = cursor.snapshot;
    offset = cursor.offset;
    const [data] = await rows<{ query_hash: string; ordered_ids: string[]; expires_at: string }>(
      "SELECT query_hash,ordered_ids,expires_at FROM template_search_snapshots WHERE id=?",
      [id],
    );
    if (!data || Date.parse(data.expires_at) <= Date.now())
      throw new TemplateError("CURSOR_EXPIRED", 410, "Refresh to see the latest templates.");
    if (data.query_hash !== hash) throw new TemplateError("INVALID_REQUEST");
    ids = parseJSON(data.ordered_ids);
  } else {
    ids = await candidates(query, kind === "popular", excluded);
    id = randomUUID();
    await write("INSERT INTO template_search_snapshots(id,query_hash,ordered_ids) VALUES (?,?,?)", [
      id,
      hash,
      JSON.stringify(ids),
    ]);
  }
  const items = [];
  while (offset < ids.length && items.length < input.limit) {
    const batch = ids.slice(offset, Math.min(offset + input.limit - items.length, ids.length));
    const data = await rows<TemplateRow>(
      `SELECT * FROM template_records WHERE id IN (${batch.map(() => "?").join(",")}) AND visibility='public' AND discovery_state='eligible'`,
      batch,
    );
    const records = new Map(data.map((t) => [t.id, t]));
    for (const candidate of batch) {
      offset++;
      const t = records.get(candidate);
      if (!t || !t.cover_asset_id) continue;
      try {
        checkReadable(t);
      } catch (e) {
        if (e instanceof TemplateError && e.status === 410) continue;
        throw e;
      }
      items.push(card(t));
    }
  }
  return {
    items,
    nextCursor: offset < ids.length ? cursorEncode(id, offset, hash) : null,
    ...(offset >= 200 ? { refreshRequired: true } : {}),
  };
}
export async function search(input: z.infer<typeof searchSchema>) {
  const code = queryCode(input.query, input.mode);
  if (code) {
    if (input.cursor) throw new TemplateError("INVALID_REQUEST");
    const t = await ensureSnapshot(await byCode(code));
    if (input.excludedTemplateIDs.includes(t.id))
      return {
        contractVersion: 2,
        queryType: "code",
        sections: [],
        nextCursor: null,
        resolvedTemplate: null,
        autoOpenTemplateID: null,
      };
    return {
      contractVersion: 2,
      queryType: "code",
      sections: [{ visibility: t.visibility, items: [card(t)] }],
      nextCursor: null,
      resolvedTemplate: detail(t),
      autoOpenTemplateID: t.id,
    };
  }
  if (!enabled("SEARCH"))
    throw new TemplateError("SERVICE_UNAVAILABLE", 503, "Search is temporarily unavailable.", true);
  const page = await publicPage(input, input.query, "keyword");
  return {
    contractVersion: 2,
    queryType: "keyword",
    sections: [{ visibility: "public", items: page.items }],
    nextCursor: page.nextCursor,
    resolvedTemplate: null,
    autoOpenTemplateID: null,
    ...(page.refreshRequired ? { refreshRequired: true } : {}),
  };
}
export async function discovery(input: z.infer<typeof listSchema>) {
  if (!enabled("SEARCH"))
    throw new TemplateError("SERVICE_UNAVAILABLE", 503, "Search is temporarily unavailable.", true);
  const terms = (locale: string) =>
    database().template_trending_terms.findMany({
      where: { locale, enabled: true },
      orderBy: { sort_order: "asc" },
      take: 8,
      select: { term: true },
    });
  let data = await terms(input.locale);
  if (!data.length && input.locale !== "en") data = await terms("en");
  return {
    contractVersion: 2,
    trending: data ?? [],
    popular: await publicPage(input),
    links: {
      removal: `${shareOrigin()}/templates/contact?kind=removal`,
      companyRequest: `${shareOrigin()}/templates/contact?kind=company`,
    },
  };
}

export async function candidates(query: string, popular: boolean, excluded: string[]) {
  const args: unknown[] = [];
  let filter = "";
  if (excluded.length) {
    filter += ` AND CAST(id AS CHAR) NOT IN (${excluded.map(() => "?").join(",")})`;
    args.push(...excluded);
  }
  if (!popular) {
    filter += " AND (LOCATE(LOWER(?),LOWER(watermark_name))>0 OR LOCATE(LOWER(?),LOWER(COALESCE(company_name,'')))>0)";
    args.push(query, query);
  }
  let order = "use_count DESC,created_at DESC,id DESC";
  if (!popular) {
    order =
      "CASE WHEN LOWER(watermark_name)=LOWER(?) THEN 0 WHEN LOWER(company_name)=LOWER(?) THEN 1 WHEN LOCATE(LOWER(?),LOWER(watermark_name))=1 OR LOCATE(LOWER(?),LOWER(company_name))=1 THEN 2 ELSE 3 END,created_at DESC,id DESC";
    args.push(query, query, query, query);
  }
  const data = await rows<{ id: string }>(
    `SELECT CAST(id AS CHAR) AS id FROM watermarks_share_links WHERE visibility='public' AND discovery_state='eligible' AND status=0 AND removed_at IS NULL AND (CASE WHEN contract_version=1 THEN expire_time=0 OR expire_time>UNIX_TIMESTAMP() ELSE expires_at IS NULL OR expires_at>UTC_TIMESTAMP(3) END) ${filter} ORDER BY ${order} LIMIT 200`,
    args,
  );
  return data.map((t) => t.id);
}
