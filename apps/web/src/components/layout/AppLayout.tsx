import type { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { useTelemetry } from "../../hooks/useTelemetry";

/** Shared shell. The navbar connection dot needs the live gateway latency, so
 *  the shell owns the one telemetry poll (the Monitor page shares its own). */
export function AppLayout({ children }: { children: ReactNode }) {
  const { data, error } = useTelemetry();
  const latencyMs = error ? -1 : data?.connection.latency_ms;
  const connectionOk = !error && (data?.connection.ok ?? false);

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar latencyMs={latencyMs} connectionOk={connectionOk} />
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6">{children}</main>
    </div>
  );
}