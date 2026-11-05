import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/Button";
import { DataState } from "../components/ui/DataState";
import { ApiError } from "../lib/types";

export function LoginPage() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  if (status === "populated") return <Navigate to="/keys" replace />;

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      const from = (location.state as { from?: string } | null)?.from ?? "/keys";
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, "NETWORK_ERROR", "Gagal masuk"));
    } finally {
      setSubmitting(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void submit();
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-base font-semibold text-primary" style={{ letterSpacing: "-0.01em" }}>
        Masuk
      </h1>
      <p className="mt-1 text-[13px] text-secondary">
        Lanjutkan ke dashboard member Katalis.
      </p>

      <DataState state={status === "loading" ? "loading" : "populated"} skeletonRows={2}>
        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-secondary">
            Email
            <input
              type="email"
              required
              autoComplete="email"
              className="rounded border border-hairline bg-surface px-2 py-1.5 font-sans text-[13px] text-primary outline-none focus:border-accent"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-secondary">
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              className="rounded border border-hairline bg-surface px-2 py-1.5 font-sans text-[13px] text-primary outline-none focus:border-accent"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error ? (
            <DataState
              state="error"
              errorCode={error.errorCodeLabel}
              errorMessage={error.message}
              onRetry={() => void submit()}
            />
          ) : null}

          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? "Memproses..." : "Masuk"}
          </Button>
        </form>
      </DataState>

      <p className="mt-4 text-[13px] text-secondary">
        Belum punya akun?{" "}
        <Link to="/auth/register" className="text-accent hover:underline">
          Daftar
        </Link>
      </p>
    </div>
  );
}