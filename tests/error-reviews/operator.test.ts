import assert from "node:assert/strict";
import { test } from "node:test";

import { reviewAuth } from "../../src/lib/error-reviews/auth";
import { decodeGitOperator } from "../../src/lib/error-reviews/operator";

test("Git audit identity supports Unicode and rejects malformed or missing identity", () => {
  assert.equal(
    decodeGitOperator(encodeURIComponent(JSON.stringify({ name: "开发者", email: "dev@example.test" }))),
    "git:开发者 <dev@example.test>",
  );
  for (const value of [
    null,
    "%broken",
    encodeURIComponent('{"name":"x","email":"bad"}'),
    encodeURIComponent(JSON.stringify({ name: "x\ny", email: "dev@example.test" })),
  ])
    assert.throws(() => decodeGitOperator(value));
});
test("token mutations require Git attribution after authentication; read access stays compatible", async () => {
  const old = process.env.ERROR_REVIEW_API_TOKEN;
  process.env.ERROR_REVIEW_API_TOKEN = "local-test-token-with-at-least-32-characters";
  try {
    const headers = {
      authorization: `Bearer ${process.env.ERROR_REVIEW_API_TOKEN}`,
      "x-review-git-operator": encodeURIComponent(JSON.stringify({ name: "Tester", email: "dev@example.test" })),
    };
    assert.equal(
      await reviewAuth(new Request("https://example.test", { method: "PATCH", headers })),
      "git:Tester <dev@example.test>",
    );
    await assert.rejects(() =>
      reviewAuth(
        new Request("https://example.test", { method: "POST", headers: { authorization: headers.authorization } }),
      ),
    );
    await assert.rejects(() =>
      reviewAuth(
        new Request("https://example.test", {
          method: "PATCH",
          headers: { ...headers, authorization: "Bearer invalid" },
        }),
      ),
    );
    assert.match(
      await reviewAuth(new Request("https://example.test", { headers: { authorization: headers.authorization } })),
      /^skill:/,
    );
  } finally {
    if (old === undefined) delete process.env.ERROR_REVIEW_API_TOKEN;
    else process.env.ERROR_REVIEW_API_TOKEN = old;
  }
});
