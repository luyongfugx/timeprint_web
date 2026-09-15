import { randomUUID } from "node:crypto";

import { z } from "zod";

import { text } from "@/lib/templates/contracts";
import { body, endpoint, json } from "@/lib/templates/http";
import { publish } from "@/lib/templates/publish-service";
import { requestLimit } from "@/lib/templates/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function OPTIONS(req: Request) {
  return endpoint(req, async () => new Response(null, { status: 204 }), true);
}
export async function POST(req: Request) {
  return endpoint(
    req,
    async () => {
      console.log("post before requeslimit");
      await requestLimit(req, "legacy-create", 10);
      const input = await body(
        req,
        z
          .object({
            watermarkName: text(255, 1),
            companyName: text(100).optional(),
            coverImageUrl: z.string().url().max(2048),
            jsonDownloadUrl: z.string().url().max(2048),
            status: z.literal(0).optional(),
            userId: z.string().min(1).max(128).optional(),
            expireType: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).default(0),
          })
          .strict(),
      );
      console.log(input);
      const result = await publish(
        req,
        {
          contractVersion: 2,
          clientRequestID: randomUUID(),
          visibility: "public",
          watermarkName: input.watermarkName,
          companyName: input.companyName ?? "",
          coverImageURL: input.coverImageUrl,
          jsonDownloadURL: input.jsonDownloadUrl,
          coverKind: "watermark",
          coverWidth: 1,
          coverHeight: 1,
          userID: input.userId ?? "legacy-anonymous",
        },
        1,
        [0, 2_592_000, 86_400, 3_600][input.expireType],
      );
      console.log(result);
      return json({ success: true, shareCode: result.receipt.shareCode, shareLink: result.receipt.shareLink });
    },
    true,
  );
}
