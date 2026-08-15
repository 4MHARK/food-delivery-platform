import crypto from "crypto";
const tickets = new Map();

export function createTicket(userId) {
  const ticket = crypto.randomUUID();

  tickets.set(ticket, {
    userId,
    expiresAt: Date.now() + 30000,
  });
  return ticket;
}

export function consumeTicket(ticket) {
  const data = tickets.get(ticket);

  if (!data) return null;

  if (data.expiresAt < Date.now()) {
    tickets.delete(ticket);
    return null;
  }
  tickets.delete(ticket);
  return data.userId;
}

setInterval(() => {
  tickets.forEach((data, ticket) => {
    if (data.expiresAt < Date.now()) {
      tickets.delete(ticket);
    }
  });
}, 60000);
export default tickets;
