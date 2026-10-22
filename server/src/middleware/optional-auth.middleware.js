import jwt from "jsonwebtoken";

// Like authMiddleware, but never rejects. Use on public routes that reveal a
// little more to the resource owner when a token happens to be present.
const optionalAuthMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return next();

  const token = authHeader.split(" ")[1];
  if (!token) return next();

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    // Invalid or expired tokens are treated as anonymous on a public route.
  }
  next();
};

export default optionalAuthMiddleware;
