import { Link, useLocation } from "react-router-dom";
import HomeIcon from '@mui/icons-material/Home';
import FlagIcon from '@mui/icons-material/Flag';
import BarChartIcon from '@mui/icons-material/BarChart';
import ForumIcon from '@mui/icons-material/Forum';
const links = [
  { to: "/", label: "Home", icon: <HomeIcon/> },
  { to: "/goals", label: "Goals", icon: <FlagIcon/> },
  { to: "/results", label: "Stats", icon: <BarChartIcon/> },
  { to: "/share", label: "Social", icon: <ForumIcon/> },
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
