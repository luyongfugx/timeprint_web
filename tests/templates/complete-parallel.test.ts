import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";

import sharp from "sharp";

import type { Asset, Session } from "../../src/lib/templates/asset-service";
import { sha256 } from "../../src/lib/templates/crypto";

const load = createRequire(import.meta.url);
test("parallel complete keeps image bytes, payload references, validation and atomic ready transition", async (t) => {
  function replace(path: string, overrides: Record<string, unknown>) {
    const original = load(path),
      cached = load.cache[load.resolve(path)]!;
    cached.exports = { ...original, ...overrides };
    t.after(() => {
      cached.exports = original;
    });
  }
  const sid = randomUUID(),
    coverID = randomUUID(),
    payloadID = randomUUID();
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "white" } })
    .png()
    .toBuffer();
  let records: Asset[] = [],
    committed = 0,
    uploads = new Map<string, Buffer>();
  let downloadActive = 0,
    downloadPeak = 0,
    uploadActive = 0,
    uploadPeak = 0;
  let corrupt = false,
    failUpload = false;
  const originals = new Map<string, Buffer>();
  replace("../../src/lib/templates/repository", {
    rows: async () => records.map((a) => ({ ...a })),
    completeSessionRecord: async (
      _sid: string,
      _token: string,
      sealed: { id: string; sealedKey: string; sealedSHA256: string }[],
      _manifest: string,
      receipt: unknown,
    ) => {
      committed++;
      assert.equal(downloadActive + uploadActive, 0);
      assert.equal(sealed.length, records.length);
      for (const asset of sealed) {
        const bytes = uploads.get(asset.sealedKey)!;
        assert.equal(sha256(bytes), asset.sealedSHA256);
        if (asset.id === payloadID) assert.equal(JSON.parse(bytes.toString()).coverUrl, `template-asset:${coverID}`);
        else assert.deepEqual(bytes, png);
      }
      return receipt;
    },
  });
  replace("../../src/lib/templates/storage", {
    downloadObject: async (key: string) => {
      downloadPeak = Math.max(downloadPeak, ++downloadActive);
      await setImmediate();
      downloadActive--;
      return corrupt ? Buffer.from("invalid") : originals.get(key)!;
    },
    uploadObject: async (key: string, bytes: Buffer) => {
      uploadPeak = Math.max(uploadPeak, ++uploadActive);
      await setImmediate();
      uploadActive--;
      if (failUpload) throw new Error("COS failed");
      uploads.set(key, bytes);
    },
  });
  const { completeSession, referenceURL } = load("../../src/lib/templates/asset-service");
  const payload = Buffer.from(JSON.stringify({ watermarkModel: { items: [] }, coverUrl: referenceURL(sid, coverID) }));
  records = [coverID, payloadID, randomUUID(), randomUUID()].map((id, index) => {
    const bytes = index === 1 ? payload : png;
    const key = `staging/${sid}/${id}`;
    originals.set(key, bytes);
    return {
      id,
      upload_session_id: sid,
      kind: index === 0 ? "cover" : index === 1 ? "payload" : "logo",
      object_key: key,
      bytes: bytes.length,
      sha256: sha256(bytes),
      mime: index === 1 ? "application/json" : "image/png",
    } as Asset;
  });
  const session = { id: sid, state: "uploading", purpose: "template", visibility: "private" } as Session;
  const receipt = await completeSession(session, "token", coverID, payloadID);
  assert.equal(receipt.state, "ready");
  assert.equal(receipt.coverWidth, 8);
  assert.equal(downloadPeak, 3);
  assert.equal(uploadPeak, 3);
  assert.equal(committed, 1);
  corrupt = true;
  uploads = new Map();
  await assert.rejects(completeSession(session, "token", coverID, payloadID), { code: "RESOURCE_INVALID" });
  assert.equal(uploads.size, 0);
  assert.equal(committed, 1);
  corrupt = false;
  failUpload = true;
  await assert.rejects(completeSession(session, "token", coverID, payloadID));
  assert.equal(committed, 1);
  assert.equal(uploadActive, 0);
});
