import type { ReactNode } from 'react';
import {
  listingAbout,
  listingDescription,
  listingFacts,
  listingHowToAccess,
  listingScreenshotUrls,
  listingWebDetailUrl,
  type ListingFact,
} from '../marketplace/listingMedia';
import type { MarketplaceCatalogEntry } from '../marketplace/types';
import { openExternal } from '../desktopWorkspace';

type Props = {
  entry: MarketplaceCatalogEntry;
  catalogUrl: string;
  iconUrl: string | null;
  actions?: ReactNode;
  contributions?: string[];
  contributionsLoading?: boolean;
  contributionsError?: string | null;
};

function FactsList({ facts }: { facts: ListingFact[] }) {
  return (
    <dl className="marketplace-detail-facts marketplace-detail-facts-grid">
      {facts.map((f) => (
        <div key={f.label}>
          <dt>{f.label}</dt>
          <dd>{f.label === 'Extension ID' ? <code>{f.value}</code> : f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Shared marketplace detail layout (matches project-objectiv.com extension pages). */
export default function ExtensionListingDetail({
  entry,
  catalogUrl,
  iconUrl,
  actions,
  contributions,
  contributionsLoading,
  contributionsError,
}: Props) {
  const description = listingDescription(entry);
  const about = listingAbout(entry);
  const steps = listingHowToAccess(entry);
  const shots = listingScreenshotUrls(entry, catalogUrl);
  const facts = listingFacts(entry);
  const showAboutBlock = about !== description;

  return (
    <>
      <div className="marketplace-detail-hero">
        <div className="marketplace-detail-icon" aria-hidden>
          {iconUrl ? (
            <img src={iconUrl} alt="" width={64} height={64} />
          ) : (
            <span className="codicon codicon-extensions" />
          )}
        </div>
        <div className="marketplace-detail-meta">
          <h2 className="marketplace-detail-name">{entry.name}</h2>
          <p className="marketplace-detail-sub">
            {entry.publisher} · v{entry.version}
          </p>
          <div className="marketplace-tags marketplace-detail-tags">
            {entry.categories.map((t) => (
              <span key={t} className="marketplace-tag">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {actions}

      <section className="marketplace-detail-section">
        <h3>Description</h3>
        <p className="marketplace-detail-desc">{description}</p>
      </section>

      {showAboutBlock && (
        <section className="marketplace-detail-section">
          <h3>About</h3>
          <p className="marketplace-detail-desc">{about}</p>
        </section>
      )}

      {shots.length > 0 && (
        <section className="marketplace-detail-section">
          <h3>Screenshots</h3>
          <div className="marketplace-screenshots">
            {shots.map((src) => (
              <button
                key={src}
                type="button"
                className="marketplace-screenshot-btn"
                onClick={() => void openExternal(src)}
                title="Open screenshot"
              >
                <img src={src} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="marketplace-detail-section">
        <h3>How to access</h3>
        <ol className="marketplace-howto-list">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="marketplace-detail-section">
        <h3>Details</h3>
        <FactsList facts={facts} />
      </section>

      {contributionsLoading && (
        <p className="marketplace-detail-muted">Loading package contributions…</p>
      )}
      {contributionsError && <p className="marketplace-error">{contributionsError}</p>}
      {!contributionsLoading && contributions && contributions.length > 0 && (
        <section className="marketplace-detail-section">
          <h3>Contributions</h3>
          <ul className="marketplace-contrib-list">
            {contributions.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      <button
        type="button"
        className="marketplace-link-btn"
        onClick={() => void openExternal(listingWebDetailUrl(entry.id))}
      >
        <span className="codicon codicon-link-external" aria-hidden />
        View on marketplace website
      </button>
      <button
        type="button"
        className="marketplace-link-btn"
        onClick={() =>
          void openExternal(
            'https://www.project-objectiv.com/auth/login?return_to=/publish/',
          )
        }
      >
        <span className="codicon codicon-account" aria-hidden />
        Publisher sign-in (web)
      </button>
    </>
  );
}
