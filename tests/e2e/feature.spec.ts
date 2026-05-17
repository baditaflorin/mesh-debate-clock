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
