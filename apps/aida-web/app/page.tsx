import { Link } from "react-router";

export default function LandingPage() {
  return (
    <div className="public-page">
      <div className="public-card public-card--hero">
        <p className="public-card__kicker">AIDA Enterprise SaaS</p>
        <h1>Wind Blade Operations, Documentation, and Reporting in One Browser Platform</h1>
        <p>
          Manage projects, sites, turbines, blades, crews, evidence, and engineer collaboration with strict tenant isolation
          from day one.
        </p>

        <div className="public-card__actions">
          <Link to="/login" className="button button--primary">
            Login
          </Link>
          <Link to="/sign-up" className="button button--ghost">
            Sign Up
          </Link>
          <Link to="/dashboard" className="button button--ghost">
            Open MVP Workspace
          </Link>
        </div>
      </div>
    </div>
  );
}
