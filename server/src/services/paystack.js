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

// Create a reusable Transfer Recipient (nuban bank account). Returns the
// `recipient_code` we store and reuse for every transfer to that account.
export async function createTransferRecipient({ name, accountNumber, bankCode }) {
  const response = await fetch(`${PAYSTACK_BASE}/transferrecipient`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "nuban",
      name,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: "NGN",
    }),
  });

  const body = await response.json();

  if (!body.status) {
    return { ok: false, message: body.message, data: body };
  }

  return {
    ok: true,
    recipientCode: body.data.recipient_code,
    accountName: body.data.details?.account_name,
    data: body.data,
  };
}

// Initiate a transfer from the Paystack balance to a recipient. `amountKobo` is
// the amount in kobo (naira × 100). The transfer may be queued; check
// `verifyTransfer` for its final status.
export async function initiateTransfer({ recipientCode, amountKobo, reference, reason }) {
  const response = await fetch(`${PAYSTACK_BASE}/transfer`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source: "balance",
      amount: amountKobo,
      recipient: recipientCode,
      reference,
      reason,
      currency: "NGN",
    }),
  });

  const body = await response.json();

  if (!body.status) {
    return { ok: false, message: body.message, data: body };
  }

  return { ok: true, data: body.data };
}

export async function verifyTransfer(reference) {
  const response = await fetch(
    `${PAYSTACK_BASE}/transfer/verify/${encodeURIComponent(reference)}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    }
  );

  const body = await response.json();

  return {
    ok: Boolean(body.status),
    data: body.data,
  };
}

// Resolve an account number + bank code to the account holder's name
// (Paystack's "Resolve Account Number" endpoint). Used to show the account
// name for confirmation *before* we create a transfer recipient, so the owner
// or rider can catch a typo in the account number before saving it.
export async function resolveAccount({ accountNumber, bankCode }) {
  const url =
    `${PAYSTACK_BASE}/bank/resolve?account_number=${encodeURIComponent(accountNumber)}` +
    `&bank_code=${encodeURIComponent(bankCode)}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    },
  });

  const body = await response.json();

  if (!body.status) {
    return { ok: false, message: body.message };
  }

  return {
    ok: true,
    accountName: body.data?.account_name,
    data: body.data,
  };
}

// List every active bank Paystack supports for NGN transfers, so the
// bank-details form can show a real dropdown instead of a hardcoded list.
export async function listBanks() {
  const response = await fetch(`${PAYSTACK_BASE}/bank?currency=NGN`, {
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    },
  });

  const body = await response.json();

  if (!body.status) {
    return { ok: false, message: body.message };
  }

  // Paystack returns some bank codes more than once (same bank, different
  // entry). De-duplicate by code so the dropdown has unique options — and so
  // the React `key={b.code}` stays unique.
  const banks = [];
  const seen = new Set();
  for (const b of body.data || []) {
    if (b.active === false) continue;
    if (seen.has(b.code)) continue;
    seen.add(b.code);
    banks.push({ name: b.name, code: b.code });
  }
  banks.sort((a, b) => a.name.localeCompare(b.name));

  return { ok: true, banks };
}
