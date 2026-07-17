import jwt from "jsonwebtoken";
const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
      console.log("AUTH HEADER:", authHeader);
    console.log("JWT SECRET EXISTS:", !!process.env.JWT_SECRET);
    if (!authHeader) {
      return res.status(401).json({
        message: "Authorization Header is Missing.",
      });
    }
    const token = authHeader.split(" ")[1];
     console.log("TOKEN:", token);
    if (!token) {
      return res.status(401).json({
        message: "Token Missing",
      });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("DECODED:", decoded);
    req.user = decoded;
    next();
  } catch (error) {
     console.log("JWT ERROR:", error.message);
    return res.status(401).json({
      message: "Invalid or Expired Token",
    });
  }
};
export default authMiddleware;
