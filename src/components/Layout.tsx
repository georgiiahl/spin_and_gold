import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const showBackButton = location.pathname !== '/';

  function handleBack() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/');
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header
        className="sticky top-0 z-20 border-b border-gray-200 bg-white"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex h-12 items-center px-4">
          <div className="flex items-center gap-2">
            {showBackButton && (
              <button
                type="button"
                onClick={handleBack}
                aria-label="Go back"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-lg text-gray-700 hover:bg-gray-100"
              >
                ←
              </button>
            )}
            <span className="text-sm font-semibold text-gray-900">S&G Trainer</span>
          </div>
          <div className="ml-auto">
            <Link
              to="/practice"
              className="rounded-md px-2 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            >
              Practice
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1 px-4 py-4 pb-8">
        <Outlet />
      </main>
    </div>
  );
}
