import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const OwnerRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== "OWNER") {
    return <Navigate to="/restaurants" replace />;
  }

  return children;
};

export default OwnerRoute;
