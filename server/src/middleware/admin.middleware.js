const adminMiddleware = (req, res, next) => {
  if (req.user.role !== "ADMIN" && req.user.role !== "SUPER_ADMIN") {
    return res.status(403).json({
      message: "Only admins can perform this action",
    });
  }
  next();
};

export default adminMiddleware;
