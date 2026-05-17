import { Header } from "@/components/header";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <Header />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

