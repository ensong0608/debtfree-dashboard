"use client";
import BackButton from "./back-button";
import { useRouter } from "next/navigation";
export default function ReadingBack() {
  const router = useRouter();
  return <BackButton className="reading-back secondary" onClick={() => { if (window.history.length > 1) window.history.back(); else router.push('/'); }} aria-label="Back to DebtFree"/>;
}
