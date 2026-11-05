import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { DataState } from "./ui/DataState";

/** Member-only guard: loading -> skeleton, unauthenticated -> /auth/login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        <DataState state="loading" skeletonRows={4} />
      </div>
    );
  }

  if (status !== "populated") {
    return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}