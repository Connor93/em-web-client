import { HOST } from './consts';

type Config = {
  host: string;
  staticHost: boolean;
  title: string;
  slogan: string;
  creditsUrl: string;
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
