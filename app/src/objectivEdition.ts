/** Product edition — Enterprise is license-gated (see objectivLicense.ts). */

export type ObjectivEdition = 'community' | 'enterprise';

export function editionLabel(edition: ObjectivEdition): string {
  return edition === 'enterprise' ? 'Enterprise' : 'Community';
}

/** Read-only Slack/chat sync (no agent send). */
export function canUseChatSync(_edition: ObjectivEdition): boolean {
  return true;
}

/** Agent draft/send + full messaging actions. */
export function canUseChatOnBehalf(edition: ObjectivEdition): boolean {
  return edition === 'enterprise';
}

export function canUseMailIntegration(edition: ObjectivEdition): boolean {
  return edition === 'enterprise';
}

export function canUseMeetingsIntegration(edition: ObjectivEdition): boolean {
  return edition === 'enterprise';
}

export function canUseFullMarketplace(edition: ObjectivEdition): boolean {
  return edition === 'enterprise';
}

/** Billion Context (bili), SCM vulnerability scans, and related org-network services. */
export function canUseProfessionalNetworkFeatures(edition: ObjectivEdition): boolean {
  return edition === 'enterprise';
}
