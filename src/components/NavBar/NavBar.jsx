import React from "react";
import "./navbar.css";
import logo from "../../assets/logo.png";

function NavBar() {
  return (
    <nav className="navbar">
      <div className="navbar-logo">
        <img src={logo} alt="PaperTrail Logo" className="logo-img" />
        <span className="logo-text">PaperTrail</span>
      </div>
      <ul className="navbar-links">
        <li>
          <a href="#features">Features</a>
        </li>
        <li>
          <a href="#prototype">Prototype</a>
        </li>
        <li>
          <a href="#about">About</a>
        </li>
        <li>
          <a href="#contact" className="nav-btn">
            Get Started
          </a>
        </li>
      </ul>
    </nav>
  );
}

export default NavBar;
