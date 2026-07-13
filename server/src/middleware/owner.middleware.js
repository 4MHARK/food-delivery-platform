const ownerMiddleware = (req, res, next) => {
  if (req.user.role !== "OWNER") {
    return res.status(403).json({
      message: "Only restaurant owners can perform this action",
    });
  }
  next();
};

export default ownerMiddleware;
