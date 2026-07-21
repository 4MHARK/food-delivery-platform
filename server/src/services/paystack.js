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
