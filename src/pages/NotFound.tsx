
import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-progest-primary/5 to-progest-secondary/5">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-progest-primary">404</h1>
        <p className="text-xl text-progest-secondary mb-4">Oops! Page not found</p>
        <Link to="/" className="text-progest-primary hover:text-progest-secondary underline">
          Return to Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
