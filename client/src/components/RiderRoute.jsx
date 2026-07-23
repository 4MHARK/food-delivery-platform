import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const RiderRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (user?.role !== "RIDER") return <Navigate to="/restaurants" replace />;

  return children;
};

export default RiderRoute;
