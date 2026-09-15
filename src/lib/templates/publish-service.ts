import "server-only";
import { session, referenceID, referenceURL, getAsset, matchesCoverReference } from "./asset-service";
import { enabled } from "./config";
import { type CreateInput } from "./contracts";
import { actorHash } from "./crypto";
import { TemplateError } from "./errors";
import { isAssetReference, legacySnapshot } from "./legacy-assets";
import { publishTransaction } from "./transactions";

export type PublishResult = {
  replay: boolean;
  receipt: { templateID: string; shareCode: string; shareLink: string; [key: string]: unknown };
};
export async function publish(
  req: Request,
  input: CreateInput,
  contract = 2,
  legacyExpiry = 0,
): Promise<PublishResult> {
  if (!enabled(input.visibility === "public" ? "PUBLIC" : "PRIVATE"))
    throw new TemplateError("SERVICE_UNAVAILABLE", 503, "Publishing is temporarily unavailable.", true);
  // The legacy /api/applink adapter passes contract=1 and generates clientRequestID server-side.
  // input.contractVersion describes the normalized input, not the client protocol.
  if (contract === 2 && req.headers.get("Idempotency-Key") !== input.clientRequestID)
    throw new TemplateError("INVALID_REQUEST", 400, "Idempotency-Key must match clientRequestID.");
  let sid = req.headers.get("X-Template-Upload-Session") ?? "",
    token = req.headers.get("X-Template-Upload-Token") ?? "";
  if (!sid) {
    if (input.visibility === "private")
      throw new TemplateError("UPLOAD_PROTOCOL_REQUIRED", 422, "Private sharing requires a controlled upload session.");
    if (isAssetReference(input.coverImageURL) || isAssetReference(input.jsonDownloadURL))
      throw new TemplateError("UPLOAD_TOKEN_INVALID", 403);
    // Old apps send ordinary asset URLs without upload headers; create the session for them.
    const snapshot = await legacySnapshot({ ...input, visibility: "public" });
    sid = snapshot.uploadSessionID;
    token = snapshot.uploadToken;
    input = { ...input, coverImageURL: snapshot.coverImageURL, jsonDownloadURL: snapshot.jsonDownloadURL };
  }
  const s = await session(sid, token, "template", true);
  if (
    s.actor_hash !== actorHash(input.userID) ||
    s.client_request_id !== input.clientRequestID ||
    s.visibility !== input.visibility
  )
    throw new TemplateError("UPLOAD_TOKEN_INVALID", 403);
  if (!["ready", "committed"].includes(s.state))
    throw new TemplateError("RESOURCE_NOT_READY", 503, "Finish uploading the template first.", true);
  const coverMatches =
    input.coverImageURL === referenceURL(sid, s.cover_asset_id) ||
    (s.visibility === "public" && matchesCoverReference(input.coverImageURL, s, await getAsset(s.cover_asset_id)));
  if (!coverMatches || referenceID(input.jsonDownloadURL, sid) !== s.payload_asset_id)
    throw new TemplateError("RESOURCE_INVALID", 422);
  // SQL performs atomic idempotency + asset binding + first publication time.
  return publishTransaction(sid, token, input, contract, legacyExpiry);
}
