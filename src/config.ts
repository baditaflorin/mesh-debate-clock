import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-debate-clock",
  description: "PRO vs CON, alternating 60-second turns, mesh-clocked.",
  accentHex: "#ff6464",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
