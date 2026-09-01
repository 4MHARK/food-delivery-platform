import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { registerPush, unregisterPush } from "../lib/push";

// Registers for web push whenever the user is logged in, and unsubscribes on logout.
export default function PushRegistrar() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      registerPush();
    } else {
      unregisterPush();
    }
  }, [isAuthenticated]);

  return null;
}
