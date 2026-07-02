// AdminSidebar.jsx — M3 Navigation Rail + Drawer hybrid

const NAV_SUPERADMIN = [
  { label: "Dashboard",  href: "dashboard", icon: "dashboard" },
  { label: "Calendar",   href: "calendar",  icon: "calendar"  },
  { label: "Services",   href: "services",  icon: "scissors"  },
  { label: "Masters",    href: "masters",   icon: "people"    },
  { label: "Settings",   href: "settings",  icon: "settings"  },
  { label: "Email",      href: "email",     icon: "mail"      },
];

const NAV_MASTER = [
  { label: "Dashboard",  href: "dashboard", icon: "dashboard" },
  { label: "Services",   href: "services",  icon: "scissors"  },
  { label: "Schedule",   href: "schedule",  icon: "calendar"  },
];

const ICONS = {
  dashboard: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>,
  calendar:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  scissors:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>,
  people:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  settings:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>,
  mail:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
  back:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  logout:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
};

function AdminSidebar({ activePage, onNavigate, role = "SUPERADMIN", brandName = "Somique Beauty" }) {
  const navItems = role === "MASTER" ? NAV_MASTER : NAV_SUPERADMIN;

  const railItem = (item) => {
    const active = activePage === item.href;
    return (
      <button key={item.href} onClick={() => onNavigate(item.href)} style={{
        width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
        padding: "12px 0", border: "none", cursor: "pointer", background: "transparent",
        color: active ? "#3B0017" : "#524344",
        fontFamily: "inherit", fontSize: 11, fontWeight: active ? 500 : 400,
        position: "relative",
      }}>
        {/* Active indicator pill */}
        <div style={{
          width: 64, height: 32, borderRadius: 9999,
          background: active ? "#FFD9DC" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background 200ms",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ color: active ? "#3B0017" : "#524344" }}>{ICONS[item.icon]}</div>
        </div>
        <span style={{ fontSize: 11, lineHeight: 1.2, textAlign: "center", whiteSpace: "nowrap" }}>{item.label}</span>
      </button>
    );
  };

  return (
    <aside style={{
      width: 80, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center",
      background: "#F9E9EA",
      borderRight: "1px solid #EDE1E1", flexShrink: 0,
      paddingTop: 8,
    }}>
      {/* Brand avatar */}
      <div style={{ width: 40, height: 40, borderRadius: 9999, background: "#FFD9DC", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, marginTop: 12 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B4A58" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M12 6v6l4 2"/></svg>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, width: "100%", display: "flex", flexDirection: "column", paddingTop: 4 }}>
        {navItems.map(railItem)}

        <div style={{ margin: "8px 12px", borderTop: "1px solid #D8C2C3" }}></div>

        <button onClick={() => onNavigate("site")} style={{
          width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          padding: "12px 0", border: "none", cursor: "pointer", background: "transparent",
          color: "#524344", fontFamily: "inherit", fontSize: 11, fontWeight: 400,
        }}>
          <div style={{ width: 64, height: 32, borderRadius: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {ICONS.back}
          </div>
          <span style={{ fontSize: 11 }}>Site</span>
        </button>
      </nav>

      {/* User avatar + logout */}
      <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 0", gap: 8, borderTop: "1px solid #D8C2C3" }}>
        <div style={{ width: 36, height: 36, borderRadius: 9999, background: "#8B4A58", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 500 }}>
          A
        </div>
        <button onClick={() => {}} style={{
          width: 64, height: 32, borderRadius: 9999, border: "none", cursor: "pointer",
          background: "transparent", color: "#524344", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {ICONS.logout}
        </button>
      </div>
    </aside>
  );
}

Object.assign(window, { AdminSidebar });
