import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);
  return {
    metadataBase,
    title: "DebtFree Dashboard",
    description: "A focused personal dashboard for debt accounts and payoff planning.",
    applicationName: "DebtFree Dashboard",
    openGraph: { title: "DebtFree Dashboard", description: "Accounts. Payments. A clear payoff plan.", type: "website", images: [{ url: "/debtfree-dashboard-social.png", width: 1536, height: 1024, alt: "DebtFree Dashboard account and payoff planning interface" }] },
    twitter: { card: "summary_large_image", title: "DebtFree Dashboard", description: "Accounts. Payments. A clear payoff plan.", images: ["/debtfree-dashboard-social.png"] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}