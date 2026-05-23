import { Fragment, useMemo } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { Menu as MenuIcon, Shield } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/cn';

type NavItem = { to: string; label: string; admin?: boolean };

const NAV_ITEMS: NavItem[] = [
  { to: '/train', label: 'Train' },
  { to: '/practice', label: 'Practice' },
  { to: '/review', label: 'Review' },
  { to: '/settings', label: 'Settings' },
];

export default function Header() {
  const location = useLocation();
  const isAdminMode = typeof window !== 'undefined' && localStorage.getItem('spin-gold-admin-mode') === 'true';

  const navItems = useMemo(() => (
    isAdminMode
      ? [...NAV_ITEMS, { to: '/admin/spots', label: 'Admin Panel', admin: true }]
      : NAV_ITEMS
  ), [isAdminMode]);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-700/80 bg-slate-950/80 backdrop-blur" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
        <NavLink to="/" className="text-lg font-extrabold tracking-tight">
          <span className="bg-gradient-to-r from-gold-300 to-amber-500 bg-clip-text text-transparent">Spin & Gold</span>
        </NavLink>

        <nav className="hidden items-center gap-2 md:flex" aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cn(
                'rounded-lg px-3 py-2 text-sm transition',
                isActive ? 'bg-slate-800 text-gold-300' : 'text-slate-200 hover:bg-slate-800',
                item.admin && 'inline-flex items-center gap-1'
              )}
            >
              {item.admin && <Shield className="h-4 w-4" aria-hidden="true" />}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <Menu as="div" className="relative md:hidden">
          <Menu.Button aria-label="Open navigation menu" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-600 bg-slate-900 text-slate-200">
            <MenuIcon className="h-5 w-5" aria-hidden="true" />
          </Menu.Button>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-200"
            enterFrom="opacity-0 translate-x-2"
            enterTo="opacity-100 translate-x-0"
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100 translate-x-0"
            leaveTo="opacity-0 translate-x-2"
          >
            <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-card focus:outline-none">
              {navItems.map((item) => (
                <Menu.Item key={item.to}>
                  {({ active }) => (
                    <NavLink
                      to={item.to}
                      className={cn(
                        'block rounded-lg px-3 py-2 text-sm text-slate-200',
                        active && 'bg-slate-800',
                        location.pathname.startsWith(item.to) && 'text-gold-300'
                      )}
                    >
                      {item.label}
                    </NavLink>
                  )}
                </Menu.Item>
              ))}
            </Menu.Items>
          </Transition>
        </Menu>
      </div>
    </header>
  );
}
