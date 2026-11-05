import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/Button";
import { DataState } from "../components/ui/DataState";
import { ApiError } from "../lib/types";

export function RegisterPage() {
  const { register, status, refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === "populated") return <Navigate to="/keys" replace />;

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await register(email, password);
      await refresh();
      const from = (location.state as { from?: string } | null)?.from ?? "/keys";
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, "NETWORK_ERROR", "Gagal mendaftar"));
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
      <h1 className="font-serif text-[22px] leading-7 font-medium tracking-[-0.015em] text-primary">
        Daftar
      </h1>
      <p className="mt-1 text-sm leading-[22px] text-pretty text-secondary">
        Buat akun member untuk mengelola API key dan saldo.
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
            Password (min. 8 karakter)
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
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
            {submitting ? "Memproses..." : "Daftar"}
          </Button>
        </form>
      </DataState>

      <p className="mt-4 text-[13px] text-secondary">
        Sudah punya akun?{" "}
        <Link to="/auth/login" className="text-accent hover:underline">
          Masuk
        </Link>
      </p>
    </div>
  );
}