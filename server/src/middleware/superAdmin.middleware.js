const superAdminMiddleware = (req, res, next) => {
  if (req.user.role !== "SUPER_ADMIN") {
    return res.status(403).json({
      message: "Only super admins can perform this action",
    });
  }
  next();
};

export default superAdminMiddleware;
