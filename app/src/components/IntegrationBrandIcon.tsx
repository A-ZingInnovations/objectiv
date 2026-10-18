import type { IntegrationBrand } from '../integrations/integrationActivity';

type Props = {
  brand: IntegrationBrand;
  className?: string;
  size?: number;
};

/** Monochrome brand marks for the activity bar (currentColor). */
export default function IntegrationBrandIcon({ brand, className = '', size = 22 }: Props) {
  const common = {
    className: `integration-brand-icon ${className}`.trim(),
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'currentColor',
    'aria-hidden': true as const,
  };

  switch (brand) {
    case 'slack':
      return (
        <svg {...common}>
          <path d="M5.5 14.5a1.75 1.75 0 1 1 0-3.5h1.75v1.75a1.75 1.75 0 0 1-1.75 1.75Zm0-6.25A1.75 1.75 0 1 1 5.5 4.5h1.75v3.75H5.5Zm6.25 6.25a1.75 1.75 0 1 1 0-3.5h3.75v1.75a1.75 1.75 0 0 1-1.75 1.75h-2Zm-1.75-6.25V4.5h1.75a1.75 1.75 0 1 1 0 3.5H9.75Zm6.25 9.5a1.75 1.75 0 1 1-3.5 0v-1.75h3.75a1.75 1.75 0 0 1-1.75 1.75h1.5Zm-6.25 0a1.75 1.75 0 1 1-3.5 0V14.5h3.75v3.75Zm9.5-6.25a1.75 1.75 0 1 1-3.5 0H14.5V9.75h3.75a1.75 1.75 0 0 1 1.75 1.75Z" />
        </svg>
      );
    case 'teams':
      return (
        <svg {...common}>
          <path d="M18.5 8.25a2.25 2.25 0 1 0-4.5 0 2.25 2.25 0 0 0 4.5 0ZM7.5 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm10.75 1.5c.69 0 1.25.56 1.25 1.25V19a1 1 0 0 1-1 1h-8.5a3 3 0 0 0-5.5-1.7V12.5c0-.69.56-1.25 1.25-1.25h12.5ZM6 11.5a4 4 0 0 1 7.75 1.25V19H6v-7.5Z" />
        </svg>
      );
    case 'google_chat':
      return (
        <svg {...common}>
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7A2.5 2.5 0 0 1 17.5 15H9l-4.5 3.5V15H6.5A2.5 2.5 0 0 1 4 12.5v-7Zm2.5-.5a.5.5 0 0 0-.5.5v7c0 .28.22.5.5.5H8v2.2L10.8 13h6.7a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.5-.5h-11Z" />
          <path d="M8 8.25h8v1.5H8v-1.5Zm0 2.75h5.5v1.5H8v-1.5Z" opacity="0.85" />
        </svg>
      );
    case 'mattermost':
      return (
        <svg {...common}>
          <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Zm0 2.2 5.5 2.75L12 10.7 6.5 8l5.5-2.8ZM6 9.35v7.3L11 18.8v-7.3L6 9.35Zm12 0-5 2.15v7.45l5-2.45v-7.15Z" />
        </svg>
      );
    case 'zoom':
      return (
        <svg {...common}>
          <path d="M4.5 7A2.5 2.5 0 0 1 7 4.5h7.35L21 11.15V16.5A2.5 2.5 0 0 1 18.5 19h-11A2.5 2.5 0 0 1 5 16.5v-9.5Zm2.5-.5a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5H11V8.5H7a.5.5 0 0 0-.5-.5Zm4 0V18h7.5a.5.5 0 0 0 .5-.5v-4.35L13.5 7Z" />
        </svg>
      );
    case 'google_meet':
      return (
        <svg {...common}>
          <path d="M6 5.5A2.5 2.5 0 0 1 8.5 3h7A2.5 2.5 0 0 1 18 5.5v13A2.5 2.5 0 0 1 15.5 21h-7A2.5 2.5 0 0 1 6 18.5v-13Zm2.5-.5a.5.5 0 0 0-.5.5v13c0 .28.22.5.5.5h7c.28 0 .5-.22.5-.5v-13a.5.5 0 0 0-.5-.5h-7ZM10 9.5l6 3-6 3v-6Z" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" opacity="0.5" />
        </svg>
      );
  }
}
