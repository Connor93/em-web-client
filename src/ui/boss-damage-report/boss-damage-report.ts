import './boss-damage-report.css';

export interface BossDamageEntry {
  name: string;
  damage: number;
  percent: number;
  exp: number;
  qualified: boolean;
}

export interface BossDamageReport {
  bossName: string;
  entries: BossDamageEntry[];
  minimumPercent: number | null;
}

export class BossDamageReportPanel {
  private container = document.getElementById('boss-damage-report')!;
  private autoHideTimer = 0;
  private localPlayerName: string | null = null;

  dismiss = () => {
    this.container.classList.remove('visible');
    window.clearTimeout(this.autoHideTimer);
  };

  setLocalPlayerName(name: string) {
    this.localPlayerName = name;
  }

  show(report: BossDamageReport) {
    window.clearTimeout(this.autoHideTimer);
    this.container.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'boss-dmg-header';

    const title = document.createElement('span');
    title.className = 'boss-dmg-title';
    title.textContent = report.bossName;

    const closeButton = document.createElement('button');
    closeButton.className = 'boss-dmg-close';
    closeButton.textContent = '\u00d7';
    closeButton.addEventListener('click', this.dismiss);

    header.appendChild(title);
    header.appendChild(closeButton);
    this.container.appendChild(header);

    // Rows
    const rows = document.createElement('div');
    rows.className = 'boss-dmg-rows';

    const maxDamage = report.entries[0]?.damage ?? 1;

    for (let i = 0; i < report.entries.length; i++) {
      const entry = report.entries[i];
      const row = document.createElement('div');
      row.className = 'boss-dmg-row boss-dmg-bar-wrapper';

      const isLocal =
        this.localPlayerName !== null &&
        entry.name.toLowerCase() === this.localPlayerName.toLowerCase();
      if (isLocal) row.classList.add('local-player');

      // Background bar
      const bar = document.createElement('div');
      bar.className = 'boss-dmg-bar';
      bar.style.width = `${(entry.damage / maxDamage) * 100}%`;
      row.appendChild(bar);

      const rank = document.createElement('span');
      rank.className = 'boss-dmg-rank';
      rank.textContent = `${i + 1}.`;
      row.appendChild(rank);

      const name = document.createElement('span');
      name.className = 'boss-dmg-name';
      if (!entry.qualified) name.classList.add('unqualified');
      name.textContent = entry.name;
      row.appendChild(name);

      const damage = document.createElement('span');
      damage.className = 'boss-dmg-damage';
      damage.textContent = entry.damage.toLocaleString();
      row.appendChild(damage);

      const percent = document.createElement('span');
      percent.className = 'boss-dmg-percent';
      percent.textContent = `${entry.percent}%`;
      row.appendChild(percent);

      if (entry.exp > 0) {
        const exp = document.createElement('span');
        exp.className = 'boss-dmg-exp';
        exp.textContent = `+${entry.exp.toLocaleString()} exp`;
        row.appendChild(exp);
      }

      rows.appendChild(row);
    }

    this.container.appendChild(rows);

    // Footer (minimum threshold note)
    if (report.minimumPercent !== null) {
      const footer = document.createElement('div');
      footer.className = 'boss-dmg-footer';
      footer.textContent = `(*) = Below ${report.minimumPercent}% minimum, consolation exp only`;
      this.container.appendChild(footer);
    }

    this.container.classList.add('visible');

    // Auto-dismiss after 30 seconds
    this.autoHideTimer = window.setTimeout(this.dismiss, 30_000);
  }
}
