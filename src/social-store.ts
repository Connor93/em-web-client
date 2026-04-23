import mitt from 'mitt';

type SocialEvents = {
  friendAdded: string;
  friendRemoved: string;
  ignoredAdded: string;
  ignoredRemoved: string;
  friendStatusChanged: { name: string; online: boolean };
};

const FRIENDS_KEY = 'friends-list';
const IGNORED_KEY = 'ignore-list';

class SocialStore {
  private friends = new Set<string>();
  private ignored = new Set<string>();
  private onlineFriends = new Set<string>();
  private emitter = mitt<SocialEvents>();
  isFirstPoll = true;

  constructor() {
    this.load();
  }

  // ── Friends ──────────────────────────────────────────────────────

  addFriend(name: string): void {
    const key = name.toLowerCase();
    if (this.friends.has(key)) return;
    this.friends.add(key);
    this.saveFriends();
    this.emitter.emit('friendAdded', key);
  }

  removeFriend(name: string): void {
    const key = name.toLowerCase();
    if (!this.friends.delete(key)) return;
    this.onlineFriends.delete(key);
    this.saveFriends();
    this.emitter.emit('friendRemoved', key);
  }

  isFriend(name: string): boolean {
    return this.friends.has(name.toLowerCase());
  }

  getFriends(): string[] {
    return [...this.friends].sort();
  }

  // ── Ignored ──────────────────────────────────────────────────────

  addIgnored(name: string): void {
    const key = name.toLowerCase();
    if (this.ignored.has(key)) return;
    this.ignored.add(key);
    this.saveIgnored();
    this.emitter.emit('ignoredAdded', key);
  }

  removeIgnored(name: string): void {
    const key = name.toLowerCase();
    if (!this.ignored.delete(key)) return;
    this.saveIgnored();
    this.emitter.emit('ignoredRemoved', key);
  }

  isIgnored(name: string): boolean {
    return this.ignored.has(name.toLowerCase());
  }

  getIgnored(): string[] {
    return [...this.ignored].sort();
  }

  // ── Online Status ────────────────────────────────────────────────

  isFriendOnline(name: string): boolean {
    return this.onlineFriends.has(name.toLowerCase());
  }

  getOnlineFriends(): string[] {
    return [...this.onlineFriends];
  }

  updateOnlineStatus(allOnlineNames: string[]): void {
    const onlineSet = new Set(allOnlineNames.map((n) => n.toLowerCase()));
    const nowOnline = new Set<string>();

    for (const friend of this.friends) {
      if (onlineSet.has(friend)) {
        nowOnline.add(friend);
      }
    }

    if (!this.isFirstPoll) {
      // Detect offline → online transitions
      for (const name of nowOnline) {
        if (!this.onlineFriends.has(name)) {
          this.emitter.emit('friendStatusChanged', { name, online: true });
        }
      }
      // Detect online → offline transitions
      for (const name of this.onlineFriends) {
        if (!nowOnline.has(name)) {
          this.emitter.emit('friendStatusChanged', { name, online: false });
        }
      }
    }

    this.onlineFriends = nowOnline;
    this.isFirstPoll = false;
  }

  resetOnlineStatus(): void {
    this.onlineFriends.clear();
    this.isFirstPoll = true;
  }

  // ── Events ───────────────────────────────────────────────────────

  on<E extends keyof SocialEvents>(
    event: E,
    handler: (data: SocialEvents[E]) => void,
  ): void {
    this.emitter.on(event, handler);
  }

  // ── Persistence ──────────────────────────────────────────────────

  private load(): void {
    try {
      const raw = localStorage.getItem(FRIENDS_KEY);
      if (raw) {
        const arr: unknown = JSON.parse(raw);
        if (Array.isArray(arr)) {
          for (const v of arr) {
            if (typeof v === 'string') this.friends.add(v.toLowerCase());
          }
        }
      }
    } catch {
      // Corrupted — use empty
    }
    try {
      const raw = localStorage.getItem(IGNORED_KEY);
      if (raw) {
        const arr: unknown = JSON.parse(raw);
        if (Array.isArray(arr)) {
          for (const v of arr) {
            if (typeof v === 'string') this.ignored.add(v.toLowerCase());
          }
        }
      }
    } catch {
      // Corrupted — use empty
    }
  }

  private saveFriends(): void {
    localStorage.setItem(FRIENDS_KEY, JSON.stringify([...this.friends]));
  }

  private saveIgnored(): void {
    localStorage.setItem(IGNORED_KEY, JSON.stringify([...this.ignored]));
  }
}

export const socialStore = new SocialStore();
