const PAYSTACK_BASE = "https://api.paystack.co";

export async function verifyPayment(reference) {
  const response = await fetch(
    `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    }
  );

  const body = await response.json();

  if (!body.status) {
    return { verified: false, data: body };
  }

  const isSuccess = body.data && body.data.status === "success";

  return {
    verified: isSuccess,
    data: body.data,
  };
}

export async function refundPayment(reference) {
  // Unlike verify, this is a POST with a JSON body. Paystack refunds are
  // asynchronous — a `true` here means the refund was *queued*, not that the
  // money has landed back on the card yet. body.data.status reflects its
  // progress ("pending" / "processed" / "failed").
  const response = await fetch(`${PAYSTACK_BASE}/refund`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ transaction: reference }),
  });

  const body = await response.json();

  if (!body.status) {
    return { refunded: false, data: body };
  }

  return {
    refunded: true,
    data: body.data,
  };
}
