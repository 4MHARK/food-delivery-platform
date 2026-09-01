// Shared refund-window logic so the cancel endpoint and the order-detail
// response always agree on the window (configurable via REFUND_WINDOW_MINUTES).
export function getRefundWindowMinutes() {
  const parsed = parseInt(process.env.REFUND_WINDOW_MINUTES ?? "3", 10);
  return Number.isFinite(parsed) ? parsed : 3;
}
