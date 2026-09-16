import { z } from "zod";

import { normalizeTrendingRegion } from "./trending-regions";

export const PRIVATE_EXPIRY_SECONDS = 2_592_000;
export const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_SESSION_BYTES = 50 * 1024 * 1024;
export const uuid = z.string().uuid();
export const text = (max: number, min = 0) =>
  z
    .string()
    .trim()
    .refine((v) => [...v].length >= min && [...v].length <= max);
export const identifier = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);
export const visibility = z.enum(["public", "private"]);
const url = z.string().url().max(2048);
export const createSchema = z
  .object({
    contractVersion: z.literal(2),
    clientRequestID: uuid,
    visibility,
    watermarkName: text(100),
    companyName: text(100),
    coverImageURL: url,
    jsonDownloadURL: url,
    coverKind: z.enum(["watermark", "photo"]),
    coverWidth: z.number().int().positive(),
    coverHeight: z.number().int().positive(),
    userID: uuid,
    expiresInSeconds: z.number().nullable().optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.visibility === "public" && (!v.watermarkName || v.expiresInSeconds != null)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Public templates need a name and cannot expire." });
    }
    if (v.visibility === "private" && (v.expiresInSeconds !== PRIVATE_EXPIRY_SECONDS || v.coverKind !== "watermark")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Private templates require a watermark cover and a 30-day expiry.",
      });
    }
  });
export type CreateInput = z.infer<typeof createSchema>;
export const sessionSchema = z.object({ clientRequestID: uuid, visibility, userID: uuid }).strict();
export const requestSessionSchema = z.object({ clientRequestID: uuid, kind: z.enum(["removal", "company"]) }).strict();
export const registerAssetSchema = z
  .object({
    clientAssetID: uuid,
    kind: z.enum(["cover", "payload", "logo", "evidence"]),
    contentType: z.enum(["application/json", "image/jpeg", "image/png", "image/webp"]),
    byteLength: z.number().int().positive().max(MAX_IMAGE_BYTES),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()
  .refine((v) =>
    v.kind === "payload"
      ? v.contentType === "application/json" && v.byteLength <= MAX_PAYLOAD_BYTES
      : v.contentType !== "application/json",
  );
export const completeSchema = z.object({ coverAssetID: uuid, payloadAssetID: uuid }).strict();
export const evidenceCompleteSchema = z.object({ attachmentIDs: z.array(uuid).min(1).max(3) }).strict();
export const listSchema = z.object({
  region: z
    .string()
    .transform((value) => value.toUpperCase())
    .refine((value) => !!normalizeTrendingRegion(value))
    .optional(),
  locale: z
    .string()
    .regex(/^[a-zA-Z0-9-]{2,35}$/)
    .default("en"),
  limit: z.number().int().min(1).max(50).default(20),
  cursor: z.string().max(2048).nullable().optional(),
  excludedTemplateIDs: z.array(identifier).max(100).default([]),
});
export const searchSchema = listSchema
  .extend({ query: text(100, 1), mode: z.enum(["auto", "keyword", "code"]).default("auto") })
  .strict();
export const useSchema = z
  .object({ clientRequestID: uuid, userID: uuid, shareCode: z.string().max(64).optional() })
  .strict();
export const reportReasons = [
  "intellectual_property",
  "fraud_deceptive",
  "impersonation_unauthorized",
  "privacy_violation",
] as const;
export const reportSchema = useSchema.extend({ reason: z.enum(reportReasons), source: text(64, 1) }).strict();
export const requestSchema = z
  .object({
    clientRequestID: uuid,
    kind: z.enum(["removal", "company"]),
    templateID: identifier.optional(),
    shareLink: url.optional(),
    shareCode: z.string().max(64).optional(),
    description: text(2000, 1),
    contact: text(254).default(""),
    companyName: text(100).default(""),
    requiredFields: z.array(text(100, 1)).max(30).default([]),
    attachmentIDs: z.array(uuid).max(3).default([]),
  })
  .strict()
  .refine((v) =>
    v.kind === "company"
      ? !!v.companyName
      : [v.templateID, v.shareCode, v.shareLink, v.attachmentIDs.length].some(Boolean),
  )
  .refine((v) => !v.contact.includes("@") || z.string().email().safeParse(v.contact).success);
export const moderationSchema = z
  .object({
    action: z.enum(["remove", "restore"]),
    reason: text(2000, 1),
    expectedUpdatedAt: z.string().datetime({ offset: true }),
  })
  .strict();
export type TemplateRow = {
  id: string;
  contract_version: number;
  visibility: "public" | "private" | null;
  discovery_state: string;
  watermark_name: string;
  company_name: string | null;
  share_code: string;
  status: number;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  expire_time: number | null;
  removed_at: string | null;
  cover_kind: "watermark" | "photo";
  cover_width: number | null;
  cover_height: number | null;
  cover_asset_id: string | null;
  payload_asset_id: string | null;
  use_count: number;
  payload_schema_version: number;
  content_version: number;
  cover_image_url: string;
  json_download_url: string;
};
export type TemplateDetail = {
  contractVersion: 2;
  templateID: string;
  legacy: boolean;
  visibility: "public" | "private" | null;
  watermarkName: string;
  companyName: string;
  shareCode: string;
  shareLink: string;
  cover: { kind: "watermark" | "photo"; url: string; thumbnailURL: string; width: number; height: number };
  payload: { url: string; schemaVersion: number; contentVersion: number };
  useCount: number | null;
  createdAt: string;
  expiresAt: string | null;
  canShare: boolean;
  canReport: boolean;
};
