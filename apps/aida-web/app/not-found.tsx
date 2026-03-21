import { Link } from "react-router";

export default function NotFoundPage() {
  return (
    <div className="public-page">
      <div className="public-card">
        <p className="public-card__kicker">404</p>
        <h1>Route not found</h1>
        <p>The requested AIDA page does not exist.</p>
        <Link to="/dashboard" className="button button--primary">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
