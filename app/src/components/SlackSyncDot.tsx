export type SlackSyncVisual = 'live' | 'offline' | 'loading';

type Props = {
  state: SlackSyncVisual;
  className?: string;
  title?: string;
};

export default function SlackSyncDot({ state, className = '', title }: Props) {
  const label =
    title ??
    (state === 'live'
      ? 'Slack connected — live sync'
      : state === 'loading'
        ? 'Connecting to Slack…'
        : 'Offline — showing saved conversations');

  return (
    <span
      className={`slack-sync-dot slack-sync-dot--${state} ${className}`.trim()}
      title={label}
      aria-label={label}
      role="status"
    />
  );
}
