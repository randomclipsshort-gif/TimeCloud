import test from "node:test";
import assert from "node:assert/strict";
import { getApiBaseUrl } from "./apiBaseUrl.js";

test("production API requests use the same-origin proxy", () => {
  assert.equal(
    getApiBaseUrl("https://timecloud.onrender.com", true),
    "",
  );
});

test("development can use the configured API origin", () => {
  assert.equal(
    getApiBaseUrl(" http://127.0.0.1:10000/// ", false),
    "http://127.0.0.1:10000",
  );
  assert.equal(getApiBaseUrl(undefined, false), "");
});
