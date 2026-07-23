const riderMiddleware = (req, res, next) => {
  if (req.user.role !== "RIDER") {
    return res.status(403).json({
      message: "Only riders can perform this action",
    });
  }
  next();
};

export default riderMiddleware;
