import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMarketplaceErrorMessage } from "./buildMarketplaceErrorMessage.ts";

const FALLBACK = "安装失败";
const RATE_LIMITED = "请求太频繁，请稍后再试";

test("buildMarketplaceErrorMessage appends the backend reason to the fallback", () => {
  assert.equal(
    buildMarketplaceErrorMessage("Skill 缺少仓库地址，暂不支持安装", FALLBACK, RATE_LIMITED),
    "安装失败 — Skill 缺少仓库地址，暂不支持安装",
  );
});

test("buildMarketplaceErrorMessage unwraps Error instances", () => {
  assert.equal(
    buildMarketplaceErrorMessage(new Error("下载文件失败: 404"), FALLBACK, RATE_LIMITED),
    "安装失败 — 下载文件失败: 404",
  );
});

test("buildMarketplaceErrorMessage prefers the rate-limit wording over the raw reason", () => {
  // Wording is actionable ("wait and retry"), so it must win even though a
  // detail is available to append.
  assert.equal(buildMarketplaceErrorMessage("HTTP 429", FALLBACK, RATE_LIMITED), RATE_LIMITED);
  assert.equal(
    buildMarketplaceErrorMessage("Too Many Requests", FALLBACK, RATE_LIMITED),
    RATE_LIMITED,
  );
  assert.equal(
    buildMarketplaceErrorMessage("GitHub rate limit exceeded", FALLBACK, RATE_LIMITED),
    RATE_LIMITED,
  );
  assert.equal(
    buildMarketplaceErrorMessage("请求过于频繁", FALLBACK, RATE_LIMITED),
    RATE_LIMITED,
  );
});

test("buildMarketplaceErrorMessage does not mistake other numbers for a 429", () => {
  assert.equal(
    buildMarketplaceErrorMessage("下载文件失败: 4290", FALLBACK, RATE_LIMITED),
    "安装失败 — 下载文件失败: 4290",
  );
});

test("buildMarketplaceErrorMessage falls back when there is no usable detail", () => {
  assert.equal(buildMarketplaceErrorMessage("", FALLBACK, RATE_LIMITED), FALLBACK);
  assert.equal(buildMarketplaceErrorMessage("   ", FALLBACK, RATE_LIMITED), FALLBACK);
  // A non-Error rejection crossing the IPC boundary stringifies to noise.
  assert.equal(buildMarketplaceErrorMessage({}, FALLBACK, RATE_LIMITED), FALLBACK);
});
