import { FormEvent, ReactNode, useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';

type Props = { children: ReactNode };

const ADMIN_FLAG = 'spin-gold-admin-mode';
const DEFAULT_CODE = 'spin-gold-admin';

export default function AdminGuard({ children }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [authenticated, setAuthenticated] = useState(() => localStorage.getItem(ADMIN_FLAG) === 'true');

  const expectedCode = useMemo(
    () => (import.meta.env.VITE_ADMIN_ACCESS_CODE as string | undefined) ?? DEFAULT_CODE,
    []
  );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.trim() !== expectedCode) {
      setError('Invalid access code');
      return;
    }
    localStorage.setItem(ADMIN_FLAG, 'true');
    setAuthenticated(true);
    setError('');
  }

  if (authenticated) {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-md items-center justify-center">
      <Card className="w-full">
        <h1 className="mb-2 text-xl font-bold text-slate-100">Admin access</h1>
        <p className="mb-4 text-sm text-slate-400">Enter admin code to open management pages.</p>
        <form onSubmit={onSubmit} className="space-y-3">
          <Input
            label="Access code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Enter code"
            error={error || undefined}
          />
          <Button type="submit" className="w-full">Enter admin panel</Button>
        </form>
      </Card>
    </div>
  );
}
