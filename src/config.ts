import { HOST } from './consts';

export type ServerEntry = {
  name: string;
  host: string;
  /**
   * Per-server dashboard API base. When set, AuraManager fetches from this URL
   * for the selected server. Falls back to top-level `dashboardUrl` if absent.
   */
  dashboardUrl?: string;
};

export type Config = {
  host: string;
  staticHost: boolean;
  title: string;
  slogan: string;
  creditsUrl: string;
  dashboardUrl?: string;
  servers?: ServerEntry[];
  autoLogin?: {
    username: string;
    password: string;
    characterName: string;
  };
};

export function getDefaultConfig(): Config {
  return {
    host: HOST,
    staticHost: false,
    title: 'EO Web Client',
    slogan: 'Web Edition!',
    creditsUrl: 'https://github.com/sorokya/eoweb',
  };
}

/**
 * Resolve the dashboard URL for a given host. If the host matches a
 * `servers[]` entry that defines its own `dashboardUrl`, that wins. Otherwise
 * falls back to the top-level `config.dashboardUrl`. Returns `undefined` if
 * no URL is configured (auras simply don't load in that case).
 */
export function dashboardUrlForHost(
  config: Config,
  host: string,
): string | undefined {
  const match = config.servers?.find((s) => s.host === host);
  if (match?.dashboardUrl !== undefined) return match.dashboardUrl;
  return config.dashboardUrl;
}

export async function loadConfig(): Promise<Config> {
  let config = getDefaultConfig();

  try {
    const response = await fetch('/config.json');
    if (response.ok) {
      config = await response.json();
    }
  } catch {
    // Use defaults
  }

  // Merge local overrides (gitignored, never deployed)
  try {
    const local = await fetch('/config.local.json');
    if (local.ok) {
      const overrides = await local.json();
      config = { ...config, ...overrides };
    }
  } catch {
    // No local config
  }

  return config;
}
