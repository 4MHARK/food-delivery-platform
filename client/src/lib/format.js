// Format a number as Nigerian Naira with thousands separators, e.g. 1250 -> "₦1,250".
export function formatCurrency(amount) {
  return `₦${Number(amount).toLocaleString()}`;
}
