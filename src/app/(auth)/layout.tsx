import { BrandMark } from "@/components/layout/brand-mark";
import { appConfig } from "@/lib/config/app";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-[oklch(0.18_0.03_230)] text-white lg:flex">
        <div className="auth-grid absolute inset-0" />
        <div className="relative z-10 flex w-full flex-col justify-between p-10">
          <BrandMark inverted />
          <div className="max-w-lg">
            <p className="text-xs tracking-[0.2em] text-teal-200/80 uppercase">
              Contract manufacturing operations
            </p>
            <h1 className="mt-4 font-heading text-4xl leading-tight font-semibold">
              A controlled workspace for GMP-aligned plant operations.
            </h1>
            <p className="mt-4 text-sm leading-6 text-white/65">
              {appConfig.name} is the operating system for third-party
              pharmaceutical manufacturing — quality, production, warehouse, and
              compliance on one audited platform.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-white/45">Traceability</p>
              <p className="mt-1 font-medium">Audit-ready</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-white/45">Access</p>
              <p className="mt-1 font-medium">Role-based</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-white/45">Records</p>
              <p className="mt-1 font-medium">Immutable log</p>
            </div>
          </div>
        </div>
      </section>
      <section className="flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">{children}</div>
      </section>
    </div>
  );
}
