"use client";
import { useRouter } from "next/navigation";
export default function ReadingBack() {
  const router = useRouter();
  return <button className="reading-back secondary" type="button" onClick={() => { if (window.history.length > 1) window.history.back(); else router.push('/'); }} aria-label="Back to DebtFree">‹ Back</button>;
}
