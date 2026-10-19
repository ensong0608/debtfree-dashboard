export type IconName = "card" | "list" | "chart" | "more" | "refresh" | "money" | "cart" | "calendar" | "home" | "car" | "receipt" | "chevron" | "settings" | "grid" | "calculator" | "pie" | "check" | "trend" | "percent" | "shield" | "plus" | "sort" | "menu" | "account" | "filter";
export default function OutlineIcon({ name }: { name: IconName }) {
  const shapes = {
    filter: <><path d="M3 5h18M6 12h12M10 19h4"/></>,
    menu: <path d="M3 6h18M3 12h18M3 18h18"/>,
    account: <><circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    trend: <><path d="m3 17 6-6 4 4 8-10M15 5h6v6"/></>,
    percent: <><path d="m5 19 14-14"/><circle cx="7" cy="7" r="3"/><circle cx="17" cy="17" r="3"/></>,
    shield: <><path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z"/><path d="m9 12 2 2 4-5"/></>,
    plus: <path d="M12 4v16M4 12h16"/>,
    sort: <><path d="M7 3v18m-4-4 4 4 4-4M17 21V3m-4 4 4-4 4 4"/></>,
    settings: <><path d="M8.94,4.61L10.06,4.24L10.26,2.15L13.74,2.15L13.94,4.24L15.06,4.61L16.12,5.14L17.74,3.81L20.19,6.26L18.86,7.88L19.39,8.94L19.76,10.06L21.85,10.26L21.85,13.74L19.76,13.94L19.39,15.06L18.86,16.12L20.19,17.74L17.74,20.19L16.12,18.86L15.06,19.39L13.94,19.76L13.74,21.85L10.26,21.85L10.06,19.76L8.94,19.39L7.88,18.86L6.26,20.19L3.81,17.74L5.14,16.12L4.61,15.06L4.24,13.94L2.15,13.74L2.15,10.26L4.24,10.06L4.61,8.94L5.14,7.88L3.81,6.26L6.26,3.81L7.88,5.14Z"/><circle cx="12" cy="12" r="3.3"/></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    calculator: <><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h1m3 0h1m3 0h1M8 15h1m3 0h1m3 0h1M8 19h1m3 0h1m3 0h1"/></>,
    pie: <><path d="M12 2v10h10A10 10 0 0 0 12 2Z"/><path d="M8 3a10 10 0 1 0 13 13H8Z"/></>,
    card: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/></>,
    list: <><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3" cy="6" r=".5"/><circle cx="3" cy="12" r=".5"/><circle cx="3" cy="18" r=".5"/></>,
    chart: <path d="M5 20v-6M12 20V9M19 20V4"/>,
    more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1"/></>,
    money: <><rect x="2" y="5" width="20" height="14" rx="2"/><ellipse cx="12" cy="12" rx="3" ry="4"/><path d="M5 8h1M18 16h1"/></>,
    cart: <><path d="M2 3h3l3 12h11l3-9H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></>,
    home: <><path d="m2 11 10-9 10 9M5 9v12h5v-7h4v7h5V9"/></>,
    car: <><path d="m5 8 2-5h10l2 5M3 16V9h18v7H3Zm2 0v4m14-4v4M7 12h1m8 0h1"/></>,
    receipt: <><rect x="5" y="2" width="14" height="20" rx="1"/><path d="M9 7h6M9 12h6M9 17h4"/></>,
    chevron: <path d="m9 5 7 7-7 7"/>,
  };
  return <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{shapes[name]}</svg>;
}
