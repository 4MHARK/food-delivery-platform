import crypto from "node:crypto";

// The handoff code is scoped to one order and guarded by a server-side attempt
// cap, so four digits is enough. The code is rotated every time an assignment
// fails (see delivery.routes.js), which is what makes a leaked code useless.
export const generateDeliveryCode = () =>
  crypto.randomInt(0, 10000).toString().padStart(4, "0");
