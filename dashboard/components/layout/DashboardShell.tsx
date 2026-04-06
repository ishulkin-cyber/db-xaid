import { TopNav } from "./TopNav";
import { Footer } from "./Footer";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        {children}
      </main>
      <Footer />
    </>
  );
}
