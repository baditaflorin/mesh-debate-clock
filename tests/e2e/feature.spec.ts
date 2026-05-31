import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

test("alice (pro) logs a point → bob sees it in pro column", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");
    await a.waitForTimeout(500);

    await a.getByRole("button", { name: "join PRO", exact: true }).click();
    await b.getByRole("button", { name: "join CON", exact: true }).click();
    await a.getByRole("button", { name: "start debate", exact: true }).click();
    await a.waitForTimeout(400);

    // Determine whose turn it is on page A and act accordingly:
    const banner = (await a.locator(".dc-turn").innerText()).toLowerCase();
    const isProTurn = banner.includes("pro");
    const speaker = isProTurn ? a : b;
    const observer = isProTurn ? b : a;
    const colClass = isProTurn ? ".dc-col-pro" : ".dc-col-con";

    await speaker.locator(".dc-input").fill("logic > vibes");
    await speaker.getByRole("button", { name: "log point", exact: true }).click();

    await expect(observer.locator(colClass)).toContainText("logic > vibes");
  } finally {
    await cleanup();
  }
});

// The core advertised claim is "alternating turns, mesh-clocked": the turn is
// derived from the shared mesh-slot + a Yjs-shared baseline, so BOTH peers must
// agree on whose turn it is, and ONLY the on-turn side may speak. This drives
// that invariant cross-peer: both peers show the same side's turn, the off-turn
// peer's input is hard-disabled, and the on-turn speaker's NAME (via useNamedPeer)
// resolves on the OPPOSITE peer's transcript — not just the point text.
test("turn-gating + author identity are consistent across peers", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");
    await a.waitForTimeout(500);

    await a.getByRole("button", { name: "join PRO", exact: true }).click();
    await b.getByRole("button", { name: "join CON", exact: true }).click();
    await a.getByRole("button", { name: "start debate", exact: true }).click();

    // Both peers must independently render the turn banner (debate phase synced).
    await expect(a.locator(".dc-turn")).toBeVisible();
    await expect(b.locator(".dc-turn")).toBeVisible();

    // Both peers must agree on which side is on turn — derived from the shared
    // mesh-slot + the Yjs-shared baselineSlot. Disagreement here would mean the
    // baseline wrote to local state instead of the doc, or the clocks diverged.
    const bannerA = (await a.locator(".dc-turn").innerText()).toLowerCase();
    const bannerB = (await b.locator(".dc-turn").innerText()).toLowerCase();
    const isProTurn = bannerA.includes("pro");
    expect(bannerB.includes("pro")).toBe(isProTurn);

    // alice = PRO, bob = CON. The on-turn side can speak; the off-turn side is
    // gated. Assert the gate from BOTH peers' point of view.
    const proCanSpeak = isProTurn; // alice's input enabled iff PRO's turn
    await expect(a.locator(".dc-input")).toBeEnabled({ enabled: proCanSpeak });
    await expect(b.locator(".dc-input")).toBeEnabled({ enabled: !proCanSpeak });

    // The on-turn speaker logs a point; the OPPOSITE peer must see both the text
    // AND the speaker's resolved display name (cross-peer useNamedPeer lookup).
    const speaker = isProTurn ? a : b;
    const observer = isProTurn ? b : a;
    const speakerName = isProTurn ? "alice" : "bob";
    const colClass = isProTurn ? ".dc-col-pro" : ".dc-col-con";

    await speaker.locator(".dc-input").fill("mesh-clocked turns enforced");
    await speaker.getByRole("button", { name: "log point", exact: true }).click();

    const observedPoint = observer.locator(`${colClass} .dc-point`).filter({
      hasText: "mesh-clocked turns enforced",
    });
    await expect(observedPoint).toBeVisible();
    await expect(observedPoint.locator(".dc-author")).toHaveText(speakerName);
  } finally {
    await cleanup();
  }
});
