import Card from '@/components/ui/Card';

export default function About() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <Card>
        <h1 className="text-xl font-bold text-slate-100">About Spin & Gold</h1>
        <p className="mt-2 text-sm text-slate-300">
          Spin & Gold is a preflop decision trainer focused on rapid repetition, visual drills, and review workflows.
        </p>
      </Card>
    </div>
  );
}
