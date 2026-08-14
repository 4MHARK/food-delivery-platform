// Reusable zod validation middleware.
// On failure, returns 400 with a consistent { message } shape.
// On success, replaces req.body with the parsed (coerced) data.
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body || {});
  if (!result.success) {
    return res.status(400).json({ message: result.error.issues[0].message });
  }
  req.body = result.data;
  next();
};
