import { AZING_LOGO_URL, OBJECTIV_MARK_URL } from '../brandAssets';
import {
  COMPANY_WORDMARK,
  PRODUCT_CODE,
  PRODUCT_NAME,
  PRODUCT_TAGLINE,
} from '../branding';

type Props = {
  /** Pixel size for mark images */
  size?: number;
  /** full: Objectiv + AZO; company: A-Zing wordmark; compact: marks only */
  variant?: 'compact' | 'full' | 'company';
  className?: string;
};

export default function ObjectivBrandLockup({
  size = 20,
  variant = 'full',
  className = '',
}: Props) {
  if (variant === 'company') {
    return (
      <span
        className={`objectiv-brand-lockup objectiv-brand-lockup--company ${className}`.trim()}
        title={PRODUCT_TAGLINE}
      >
        <img
          className="objectiv-brand-azing objectiv-brand-azing--white"
          src={AZING_LOGO_URL}
          alt=""
          width={size}
          height={size}
          decoding="async"
        />
        <span className="objectiv-brand-company-text">
          <span className="objectiv-brand-company-name">{COMPANY_WORDMARK}</span>
          <span className="objectiv-brand-company-tag">{PRODUCT_TAGLINE}</span>
        </span>
      </span>
    );
  }

  return (
    <span
      className={`objectiv-brand-lockup ${className}`.trim()}
      title={PRODUCT_TAGLINE}
    >
      <img
        className="objectiv-brand-azing objectiv-brand-azing--white"
        src={AZING_LOGO_URL}
        alt=""
        width={size}
        height={size}
        decoding="async"
      />
      {variant !== 'compact' && (
        <img
          className="objectiv-brand-mark"
          src={OBJECTIV_MARK_URL}
          alt=""
          width={size}
          height={size}
          decoding="async"
        />
      )}
      {variant === 'full' && (
        <>
          <span className="objectiv-brand-name">{PRODUCT_NAME}</span>
          <span className="objectiv-brand-azo">{PRODUCT_CODE}</span>
        </>
      )}
    </span>
  );
}