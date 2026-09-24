"use client";
import { Bell, BookUser, Compass, Crown, Hotel, Inbox, LayoutDashboard, LogOut, MessageCircle, Radar, Search, ShieldCheck, Sparkles, UserPlus, Users } from "lucide-react";
import { logout } from "@/lib/authClient";
import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/ops", label: "Overview", icon: LayoutDashboard },
  { href: "/ops/requests", label: "Request inbox", icon: Inbox },
  { href: "/ops/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { href: "/ops/mandates", label: "Mandate wallet", icon: ShieldCheck },
  { href: "/ops/guardian", label: "Trip Guardian", icon: Radar },
  { href: "/ops/access", label: "Access OS", icon: Crown },
  { href: "/ops/clients", label: "Clients", icon: Users },
  { href: "/ops/privacy", label: "Privacy desk", icon: ShieldCheck },
  { href: "/ops/membership", label: "Membership", icon: UserPlus },
  { href: "/ops/contacts", label: "Network", icon: BookUser },
  { href: "/ops/partners", label: "Hotel partners", icon: Hotel },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/" className="brand logo-brand" aria-label="Vector Privé">
        <span className="wordmark sidebar-wordmark">VECTOR PRIVÉ</span>
      </Link>
      <div className="office-label">Private office</div>
      <nav>{nav.map(n => <Link key={n.href} href={n.href} className={path === n.href ? "active" : ""}><n.icon size={18}/>{n.label}{n.label === "Request inbox" && <b>4</b>}</Link>)}</nav>
      <div className="sidebar-bottom">
        <Link href="/"><Compass size={18}/>Member view</Link><button className="sidebar-signout" onClick={async () => { window.location.href = await logout(); }}><LogOut size={18}/>Sign out</button>
        <div className="operator"><div className="avatar sm">CO</div><span><strong>Crispin O.</strong><small>Service director</small></span><i className="online"/></div>
      </div>
    </aside>
    <main><header className="topbar"><div className="search"><Search size={17}/><input placeholder="Search requests, clients, suppliers…"/><kbd>⌘ K</kbd></div><button className="icon-btn"><Bell size={19}/><span/></button><div className="ai-live"><Sparkles size={15}/>AI triage live</div></header>{children}</main>
  </div>;
}
