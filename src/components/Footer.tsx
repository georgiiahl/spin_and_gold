import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="mt-6 border-t border-slate-700/80 py-4 text-xs text-slate-400">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4">
        <span>v0.1.0 · © 2024 Spin & Gold</span>
        <div className="flex items-center gap-4">
          <Link to="/settings" className="hover:text-gold-300">Settings</Link>
          <Link to="/about" className="hover:text-gold-300">About</Link>
        </div>
      </div>
    </footer>
  );
}
