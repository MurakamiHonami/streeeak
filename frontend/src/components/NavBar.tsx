import { Link, useLocation } from "react-router-dom";

const links = [
  { to: "/", label: "Home", icon: "🏠" },
  { to: "/goals", label: "Goals", icon: "◎" },
  { to: "/results", label: "Stats", icon: "📊" },
  { to: "/share", label: "Social", icon: "👥" },
];

export function NavBar() {
  const { pathname } = useLocation();

  return (
    <nav className="bottomNav">
      <div className="bottomNavInner">
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={pathname === link.to ? "bottomNavLink active" : "bottomNavLink"}
          >
            <span className="bottomNavIcon">{link.icon}</span>
            <span className="bottomNavText">{link.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
