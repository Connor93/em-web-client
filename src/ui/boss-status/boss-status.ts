import './boss-status.css';

interface BossEntry {
  name: string;
  status: 'active' | 'cooldown' | 'ready';
  cooldownText?: string;
  kills?: { current: number; threshold: number; remaining: number };
  minPlayers?: { required: number; online: number };
  timeWindow?: string;
  cooldownDuration?: string;
}

export class BossStatusPanel {
  private container = document.getElementById('boss-status-panel')!;

  show(title: string, body: string) {
    const entries = this.parse(body);
    this.render(title, entries);
    this.container.classList.remove('hidden');
  }

  private dismiss = () => {
    this.container.classList.add('hidden');
  };

  private parse(body: string): BossEntry[] {
    // Server uses space-padding instead of newlines (util::lines_to_string)
    const lines = body
      .split(/\s{3,}/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const entries: BossEntry[] = [];
    let current: BossEntry | null = null;

    for (const line of lines) {
      // Boss header: [Name] (NPC #id)
      const headerMatch = line.match(/^\[(.+?)\]\s*\(NPC #\d+\)/);
      if (headerMatch) {
        if (current) entries.push(current);
        current = { name: headerMatch[1], status: 'ready' };
        continue;
      }

      if (!current) continue;

      const trimmed = line.trim();

      // Status
      if (trimmed.startsWith('Status:')) {
        const statusText = trimmed.substring('Status:'.length).trim();
        if (statusText === 'ACTIVE') {
          current.status = 'active';
        } else if (statusText.includes('cooldown')) {
          current.status = 'cooldown';
          const cooldownMatch = statusText.match(/(\d+m\s*\d+s)/);
          current.cooldownText = cooldownMatch
            ? `${cooldownMatch[1]} remaining`
            : statusText.replace('On cooldown', '').replace(/[()]/g, '').trim();
        } else if (statusText.length > 0) {
          current.status = 'ready';
        }
      }

      // Kills
      const killsMatch = trimmed.match(
        /^Kills:\s*(\d+)\/(\d+)\s*\((\d+) remaining\)/,
      );
      if (killsMatch) {
        current.kills = {
          current: Number(killsMatch[1]),
          threshold: Number(killsMatch[2]),
          remaining: Number(killsMatch[3]),
        };
      }

      // Min players
      const playersMatch = trimmed.match(
        /^Min players:\s*(\d+)\s*\(online:\s*(\d+)\)/,
      );
      if (playersMatch) {
        current.minPlayers = {
          required: Number(playersMatch[1]),
          online: Number(playersMatch[2]),
        };
      }

      // Time window
      const timeMatch = trimmed.match(/^Time window:\s*(.+)/);
      if (timeMatch) {
        current.timeWindow = timeMatch[1];
      }

      // Cooldown duration
      const cdMatch = trimmed.match(/^Cooldown:\s*(.+)/);
      if (cdMatch) {
        current.cooldownDuration = cdMatch[1];
      }
    }

    if (current) entries.push(current);
    return entries;
  }

  private render(title: string, entries: BossEntry[]) {
    this.container.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'boss-status-header';

    const titleElement = document.createElement('span');
    titleElement.className = 'boss-status-title';
    titleElement.textContent = title;

    const closeButton = document.createElement('button');
    closeButton.className = 'boss-status-close';
    closeButton.textContent = '\u00d7';
    closeButton.addEventListener('click', this.dismiss);

    header.appendChild(titleElement);
    header.appendChild(closeButton);
    this.container.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'boss-status-body';

    for (const entry of entries) {
      body.appendChild(this.renderEntry(entry));
    }

    this.container.appendChild(body);
  }

  private renderEntry(entry: BossEntry): HTMLDivElement {
    const element = document.createElement('div');
    element.className = 'boss-status-entry';

    const name = document.createElement('div');
    name.className = 'boss-status-name';
    name.textContent = entry.name;
    element.appendChild(name);

    const details = document.createElement('div');
    details.className = 'boss-status-details';

    // Status
    const statusRow = this.createDetail('Status');
    const statusValue = statusRow.querySelector(
      '.boss-status-detail-value',
    ) as HTMLSpanElement;
    if (entry.status === 'active') {
      statusValue.textContent = 'Active';
      statusValue.classList.add('status-active');
    } else if (entry.status === 'cooldown') {
      statusValue.textContent = entry.cooldownText || 'On cooldown';
      statusValue.classList.add('status-cooldown');
    } else {
      statusValue.textContent = 'Ready to spawn';
      statusValue.classList.add('status-ready');
    }
    details.appendChild(statusRow);

    // Kills progress
    if (entry.kills) {
      const killRow = document.createElement('div');
      killRow.className = 'boss-status-detail';

      const label = document.createElement('span');
      label.className = 'boss-status-detail-label';
      label.textContent = 'Kills:';
      killRow.appendChild(label);

      const progress = document.createElement('div');
      progress.className = 'boss-status-progress';

      const bar = document.createElement('div');
      bar.className = 'boss-status-progress-bar';

      const fill = document.createElement('div');
      fill.className = 'boss-status-progress-fill';
      const percent = (entry.kills.current / entry.kills.threshold) * 100;
      fill.style.width = `${Math.min(percent, 100)}%`;
      bar.appendChild(fill);

      const text = document.createElement('span');
      text.className = 'boss-status-progress-text';
      text.textContent = `${entry.kills.current}/${entry.kills.threshold}`;

      progress.appendChild(bar);
      progress.appendChild(text);
      killRow.appendChild(progress);
      details.appendChild(killRow);
    }

    // Min players
    if (entry.minPlayers) {
      const met = entry.minPlayers.online >= entry.minPlayers.required;
      const row = this.createDetail(
        'Players',
        `${entry.minPlayers.online}/${entry.minPlayers.required}`,
      );
      const value = row.querySelector(
        '.boss-status-detail-value',
      ) as HTMLSpanElement;
      value.style.color = met ? '#7ec87e' : '#e8a050';
      details.appendChild(row);
    }

    // Time window
    if (entry.timeWindow) {
      details.appendChild(this.createDetail('Window', entry.timeWindow));
    }

    // Cooldown duration
    if (entry.cooldownDuration) {
      details.appendChild(
        this.createDetail('Cooldown', entry.cooldownDuration),
      );
    }

    element.appendChild(details);
    return element;
  }

  private createDetail(label: string, value?: string): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'boss-status-detail';

    const labelElement = document.createElement('span');
    labelElement.className = 'boss-status-detail-label';
    labelElement.textContent = `${label}:`;

    const valueElement = document.createElement('span');
    valueElement.className = 'boss-status-detail-value';
    valueElement.textContent = value ?? '';

    row.appendChild(labelElement);
    row.appendChild(valueElement);
    return row;
  }
}
