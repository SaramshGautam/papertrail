import React from "react";
import { Link, NavLink } from "react-router-dom";
import "./navbar.css";
import logo from "../../assets/logo.png";

function NavBar() {
  return (
    <nav className="navbar">
      <div className="navbar-logo">
        <Link to="/landing" className="logo-link">
          <img src={logo} alt="PaperTrail Logo" className="logo-img" />
          <span className="logo-text">PaperTrail</span>
        </Link>
      </div>

      <ul className="navbar-links">
        <li>
          {/* About section on the landing page */}
          <NavLink
            to="/about"
            className={({ isActive }) =>
              "nav-link" + (isActive ? " nav-link-active" : "")
            }
          >
            About
          </NavLink>
        </li>

        {/* <li>

          <NavLink
            to="/landing#contact"
            className={({ isActive }) =>
              "nav-btn" + (isActive ? " nav-btn-active" : "")
            }
          >
            Get Started
          </NavLink>
        </li> */}
      </ul>
    </nav>
  );
}

export default NavBar;
