import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl font-bold text-[var(--terminal-red)] tabular-nums mb-2">404</div>
        <div className="text-[11px] tracking-widest text-[var(--terminal-dim)] mb-4">ROUTE NOT FOUND</div>
        <Link href="/">
          <span className="text-[11px] tracking-wider text-[var(--terminal-amber)] hover:underline cursor-pointer">
            ← RETURN TO TERMINAL
          </span>
        </Link>
      </div>
    </div>
  );
}
