export function ProgressBar({ value, tone = 'primary' }: { value: number; tone?: 'primary' | 'purple' }) {
  return (
    <div className={`pbar pbar-${tone}`}>
      <div className="pbar-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
