import { BrandMark } from "@/components/layout/brand-mark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-[oklch(0.18_0.03_230)] text-white lg:flex">
        <div className="auth-grid absolute inset-0" />
        <div className="relative z-10 flex w-full flex-col justify-between p-10">
          <BrandMark inverted size="lg" />
          <div className="max-w-lg">
            <p className="text-xs tracking-[0.2em] text-teal-200/80 uppercase">
              Bhiwadi · contract manufacturing
            </p>
            <h1 className="mt-4 font-heading text-4xl leading-tight font-semibold">
              From the purchase order to the released batch, on one floor.
            </h1>
            <p className="mt-4 text-sm leading-6 text-white/65">
              Commercial orders, dispensing, QC, QA release, dispatch, and the
              books — one record for the Bhiwadi site.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-white/45">Site</p>
              <p className="mt-1 font-medium">WHO-GMP</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-white/45">This month</p>
              <p className="mt-1 font-medium">₹48.5 L</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-white/45">Release</p>
              <p className="mt-1 font-medium">Batch to COA</p>
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
