const adminMiddleware = (req, res, next) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({
      message: "Only admins can perform this action",
    });
  }
  next();
};

export default adminMiddleware;
