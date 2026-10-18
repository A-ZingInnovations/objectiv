import { useState } from 'react';
import type { ChatMessageReaction } from '../integrations/messagingHistory';
import {
  SLACK_REACTION_QUICK,
  slackReactionGlyph,
  userReacted,
} from '../integrations/slackReactions';

type Props = {
  reactions: ChatMessageReaction[];
  myUserId?: string;
  disabled?: boolean;
  /** When false, show counts only (no add / toggle). */
  interactive?: boolean;
  onToggle: (emojiName: string, currentlyMine: boolean) => Promise<void>;
};

export default function SlackMessageReactions({
  reactions,
  myUserId,
  disabled,
  interactive = true,
  onToggle,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggle = async (name: string, mine: boolean) => {
    if (disabled || busy) return;
    setBusy(true);
    try {
      await onToggle(name, mine);
    } finally {
      setBusy(false);
      setPickerOpen(false);
    }
  };

  if (!interactive && reactions.length === 0) return null;

  return (
    <div className="slack-message-reactions">
      {reactions.map((r) => {
        const mine = userReacted(r, myUserId);
        const chip = (
          <>
            <span className="slack-reaction-glyph" aria-hidden>
              {slackReactionGlyph(r.name)}
            </span>
            <span className="slack-reaction-count">{r.count}</span>
          </>
        );
        return interactive ? (
          <button
            key={r.name}
            type="button"
            className={`slack-reaction-chip ${mine ? 'slack-reaction-chip--mine' : ''}`}
            disabled={disabled || busy}
            title={mine ? 'Remove reaction' : 'Add reaction'}
            onClick={() => void toggle(r.name, mine)}
          >
            {chip}
          </button>
        ) : (
          <span
            key={r.name}
            className={`slack-reaction-chip slack-reaction-chip--readonly ${mine ? 'slack-reaction-chip--mine' : ''}`}
          >
            {chip}
          </span>
        );
      })}
      {interactive ? (
      <div className="slack-reaction-add-wrap">
        <button
          type="button"
          className="slack-reaction-add"
          aria-label="Add reaction"
          disabled={disabled || busy}
          onClick={() => setPickerOpen((o) => !o)}
        >
          ☺+
        </button>
        {pickerOpen ? (
          <div className="slack-reaction-picker" role="menu">
            {SLACK_REACTION_QUICK.map((item) => (
              <button
                key={item.name}
                type="button"
                className="slack-reaction-picker-item"
                role="menuitem"
                disabled={disabled || busy}
                onClick={() => {
                  const mine = userReacted(
                    reactions.find((x) => x.name === item.name) ?? {
                      name: item.name,
                      count: 0,
                      userIds: [],
                    },
                    myUserId,
                  );
                  void toggle(item.name, mine);
                }}
              >
                {item.glyph}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      ) : null}
    </div>
  );
}
