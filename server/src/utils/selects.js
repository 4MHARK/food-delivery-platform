// Fields that are safe to return to customers, riders, and the public.
// NEVER add bank/payout fields (bankName, bankCode, accountNumber, accountName,
// recipientCode) here — they belong only in owner/admin-scoped responses.
export const PUBLIC_RESTAURANT_SELECT = {
  id: true,
  name: true,
  description: true,
  imageUrl: true,
  address: true,
  phone: true,
  lat: true,
  lng: true,
  campusId: true,
  ownerId: true,
  approvalStatus: true,
  owner: { select: { id: true, name: true } },
};

export const PUBLIC_RESTAURANT = { select: PUBLIC_RESTAURANT_SELECT };
