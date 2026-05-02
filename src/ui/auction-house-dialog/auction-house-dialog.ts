import type { Client } from '../../client';
import type {
  AuctionConfig,
  AuctionListing,
  AuctionPriceInfo,
} from '../../handlers/auction';
import {
  AuctionListingType,
  sendAuctionBid,
  sendAuctionBuyout,
  sendAuctionCancel,
  sendAuctionList,
  sendAuctionMine,
  sendAuctionPost,
  sendAuctionPriceQuery,
} from '../../handlers/auction';
import { playSfxById, SfxId } from '../../sfx';
import { getItemGraphicPath, getItemMeta } from '../../utils';
import { Base } from '../base-ui';
import { addMobileCloseButton } from '../utils';

import './auction-house-dialog.css';

type Tab = 'browse' | 'mine' | 'bids' | 'post';
type FilterType = 'all' | 'instant' | 'auction';
type DurationIdx = 0 | 1 | 2;

const FILTER_TO_SEND: Record<FilterType, 0 | 1 | 2> = {
  all: 0,
  instant: 1,
  auction: 2,
};
const URGENT_THRESHOLD_SECS = 5 * 60; // 5 minutes — light up red
const SOON_THRESHOLD_SECS = 30 * 60; // 30 minutes — amber
const AUTO_REFRESH_MS = 30_000;
const SEARCH_DEBOUNCE_MS = 400;
const BROWSE_PAGE_SIZE = 25;

function formatTimeLeft(seconds: number): string {
  if (seconds <= 0) return 'expired';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h < 24) return rm ? `${h}h ${rm}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

interface RowState {
  el: HTMLDivElement;
  timeEl: HTMLDivElement;
  expiresAtMs: number;
  listing: AuctionListing;
}

export class AuctionHouseDialog extends Base {
  private client: Client;

  protected container = document.getElementById('auction-house')!;
  private dialogs = document.getElementById('dialogs')!;

  private title = this.container.querySelector<HTMLSpanElement>('.ah-title')!;
  private meta = this.container.querySelector<HTMLSpanElement>('.ah-meta')!;
  private tabBar = this.container.querySelector<HTMLDivElement>('.ah-tabs')!;
  private toolbar =
    this.container.querySelector<HTMLDivElement>('.ah-toolbar')!;
  private listEl = this.container.querySelector<HTMLDivElement>('.ah-list')!;
  private pagerEl = this.container.querySelector<HTMLDivElement>('.ah-pager')!;
  private pagerInfo =
    this.pagerEl.querySelector<HTMLSpanElement>('.ah-pager-info')!;
  private pagerPrev = this.pagerEl.querySelector<HTMLButtonElement>(
    'button[data-id="prev"]',
  )!;
  private pagerNext = this.pagerEl.querySelector<HTMLButtonElement>(
    'button[data-id="next"]',
  )!;
  private postForm =
    this.container.querySelector<HTMLFormElement>('.ah-post-form')!;
  private btnClose = this.container.querySelector<HTMLButtonElement>(
    '.dialog-footer button[data-id="close"]',
  );

  private searchInput =
    this.toolbar.querySelector<HTMLInputElement>('.ah-search')!;

  // Floating tooltip element (one shared instance, positioned per-hover).
  private tooltip: HTMLDivElement | null = null;

  private activeTab: Tab = 'browse';
  private filter: FilterType = 'all';
  private cfg: AuctionConfig | null = null;
  private browseListings: AuctionListing[] = [];
  private browseTotal = 0;
  private browsePage = 0;
  private myListings: AuctionListing[] = [];
  private myBids: AuctionListing[] = [];

  // Map of row state for the currently-rendered list. Used by the live
  // timer ticker to update visible time-left without re-rendering rows.
  private renderedRows: RowState[] = [];
  private tickHandle: number | null = null;
  private autoRefreshHandle: number | null = null;
  private searchTimer: number | null = null;

  // Inline-bid state: which row id has the bid input open right now.
  private inlineBidFor: number | null = null;

  // Watches the dialog container for `.hidden` being added externally —
  // the global Escape-key handler in main.ts hides dialogs by directly
  // toggling the class without calling our `hide()`, which would leak the
  // tick + auto-refresh intervals. The observer routes that path back
  // through our cleanup.
  private hiddenObserver: MutationObserver | null = null;

  // Post form state
  private postSelectedItemId = 0;
  private postType: 0 | 1 = 0; // 0 instant, 1 auction
  private postDuration: DurationIdx = 1;
  private postPriceCache: Map<number, AuctionPriceInfo> = new Map();

  constructor(client: Client) {
    super();
    this.client = client;

    // Stop pointerdown propagation inside interactive panels so the
    // dialog's draggable handler doesn't preventDefault away the click.
    // The draggable handler exempts certain selectors (`input`, `button`,
    // etc.) but our radio pills are `<label>` elements wrapping a
    // `display: none` radio — neither matches the exemption list, so
    // without this guard pointerdowns on the pills are cancelled and the
    // synthesized click never fires.
    const stopDrag = (e: Event) => e.stopPropagation();
    this.postForm.addEventListener('pointerdown', stopDrag);
    this.toolbar.addEventListener('pointerdown', stopDrag);
    this.listEl.addEventListener('pointerdown', stopDrag);
    this.pagerEl.addEventListener('pointerdown', stopDrag);

    if (this.btnClose) {
      this.btnClose.addEventListener('click', () => {
        playSfxById(SfxId.ButtonClick);
        this.hide();
      });
    }

    for (const btn of this.tabBar.querySelectorAll<HTMLButtonElement>(
      'button[data-tab]',
    )) {
      btn.addEventListener('click', () => {
        playSfxById(SfxId.ButtonClick);
        this.setTab(btn.dataset.tab as Tab);
      });
    }

    for (const btn of this.toolbar.querySelectorAll<HTMLButtonElement>(
      'button[data-filter]',
    )) {
      btn.addEventListener('click', () => {
        playSfxById(SfxId.ButtonClick);
        this.filter = btn.dataset.filter as FilterType;
        for (const b of this.toolbar.querySelectorAll<HTMLButtonElement>(
          'button[data-filter]',
        )) {
          b.classList.toggle(
            'active',
            (b.dataset.filter as FilterType) === this.filter,
          );
        }
        this.browsePage = 0; // filter change always resets to page 1
        this.requestBrowse();
      });
    }

    // Debounced search — fire 400ms after the user stops typing rather
    // than waiting for Enter. Enter still works for impatient players.
    // Search changes always reset to the first page so users don't end
    // up on page 7 of a different (smaller) result set.
    this.searchInput.addEventListener('input', () => {
      if (this.searchTimer !== null) window.clearTimeout(this.searchTimer);
      this.searchTimer = window.setTimeout(() => {
        this.searchTimer = null;
        if (this.activeTab === 'browse') {
          this.browsePage = 0;
          this.requestBrowse();
        }
      }, SEARCH_DEBOUNCE_MS);
    });
    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (this.searchTimer !== null) {
          window.clearTimeout(this.searchTimer);
          this.searchTimer = null;
        }
        this.browsePage = 0;
        this.requestBrowse();
      }
    });

    this.pagerPrev.addEventListener('click', () => {
      if (this.browsePage <= 0) return;
      playSfxById(SfxId.ButtonClick);
      this.browsePage -= 1;
      this.requestBrowse();
    });
    this.pagerNext.addEventListener('click', () => {
      const lastPage = this.lastBrowsePage();
      if (this.browsePage >= lastPage) return;
      playSfxById(SfxId.ButtonClick);
      this.browsePage += 1;
      this.requestBrowse();
    });

    const refreshBtn = this.toolbar.querySelector<HTMLButtonElement>(
      'button[data-id="refresh"]',
    );
    refreshBtn?.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.refreshActiveTab();
    });

    this.bindClientEvents();
    this.bindPostForm();
  }

  private bindClientEvents() {
    this.client.on('auctionOpened', (cfg) => {
      this.cfg = cfg;
      this.title.innerText = cfg.displayName;
      this.updateMeta();
      // Fresh open always starts on page 1 of browse with no search.
      this.browsePage = 0;
      this.searchInput.value = '';
      this.show();
      this.setTab('browse');
    });

    this.client.on('auctionListings', (page) => {
      this.browseListings = page.listings;
      this.browseTotal = page.total;
      // Snap-back if the requested page is now past the end (e.g. filter
      // change + paginated state combined to leave us off the end).
      const last = this.lastBrowsePage();
      if (this.browsePage > last) {
        this.browsePage = last;
      }
      if (this.activeTab === 'browse') this.renderList();
    });

    this.client.on('auctionMyListings', (page) => {
      if (page.filter === 0) {
        this.myListings = page.listings;
        if (this.activeTab === 'mine') this.renderList();
      } else {
        this.myBids = page.listings;
        if (this.activeTab === 'bids') this.renderList();
      }
    });

    this.client.on('auctionPostResult', (r) => {
      if (r.result === 0) {
        this.client.emit('serverChat', {
          message: `Auction listed (id #${r.newId}).`,
        });
        this.updateMeta();
        this.resetPostForm();
        this.setTab('mine');
      } else {
        this.client.emit('error', {
          title: 'Auction',
          message: this.resultMessage(r.result, 'Could not post listing.'),
        });
      }
    });

    this.client.on('auctionBidResult', (r) => {
      if (r.result === 0) {
        this.client.emit('serverChat', {
          message: `Bid placed: ${r.newBid}g on auction #${r.auctionId}.`,
        });
        this.inlineBidFor = null;
        this.refreshActiveTab();
      } else {
        this.client.emit('error', {
          title: 'Auction',
          message: this.resultMessage(r.result, 'Bid failed.'),
        });
      }
    });

    this.client.on('auctionBuyoutResult', (r) => {
      if (r.result === 0) {
        this.client.emit('serverChat', {
          message: `Bought auction #${r.auctionId}. Item is in your delivery inbox.`,
        });
        this.refreshActiveTab();
      } else {
        this.client.emit('error', {
          title: 'Auction',
          message: this.resultMessage(r.result, 'Purchase failed.'),
        });
      }
    });

    this.client.on('auctionCancelResult', (r) => {
      if (r.result === 0) {
        this.client.emit('serverChat', {
          message: `Listing #${r.auctionId} cancelled. Deposit forfeited.`,
        });
        this.refreshActiveTab();
      } else {
        this.client.emit('error', {
          title: 'Auction',
          message: this.resultMessage(r.result, 'Cancel failed.'),
        });
      }
    });

    this.client.on('auctionPriceInfo', (p) => {
      this.postPriceCache.set(p.itemId, p);
      if (this.activeTab === 'post') this.renderPostSummary();
    });

    this.client.on('auctionError', (e) => {
      this.client.emit('error', {
        title: 'Auction House',
        message: e.message || 'Auction house error.',
      });
    });
  }

  private resultMessage(code: number, fallback: string): string {
    const map: Record<number, string> = {
      1: 'You must be at the auction house.',
      2: 'That item cannot be listed.',
      3: 'Lore items cannot be auctioned.',
      4: "You don't have that many of that item.",
      5: "You don't have enough gold.",
      6: 'Invalid price.',
      7: 'Invalid quantity.',
      8: 'Invalid duration.',
      9: 'You have too many active listings.',
      10: 'Auction not found.',
      11: 'Auction already ended.',
      12: 'You cannot bid on your own listings.',
      13: 'Bid is too low.',
      14: 'No buyout available.',
      15: 'You are already the high bidder.',
      16: 'Cancel rejected — listing has bids.',
      17: 'Finish your trade or locker first.',
      18: 'Database error. Try again.',
      19: 'Price too high.',
      20: 'Cannot list while trading.',
    };
    return map[code] || fallback;
  }

  private setTab(tab: Tab) {
    this.activeTab = tab;
    this.inlineBidFor = null;
    for (const btn of this.tabBar.querySelectorAll<HTMLButtonElement>(
      'button[data-tab]',
    )) {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    }
    this.toolbar.classList.toggle('hidden', tab !== 'browse');
    this.listEl.classList.toggle('hidden', tab === 'post');
    this.postForm.classList.toggle('hidden', tab !== 'post');
    if (tab !== 'browse') this.pagerEl.classList.add('hidden');

    if (tab === 'browse') {
      this.requestBrowse();
    } else if (tab === 'mine') {
      sendAuctionMine(this.client, 0);
    } else if (tab === 'bids') {
      sendAuctionMine(this.client, 1);
    } else if (tab === 'post') {
      this.renderPostInventory();
      this.renderPostSummary();
    }
  }

  private refreshActiveTab() {
    if (this.activeTab === 'browse') this.requestBrowse();
    else if (this.activeTab === 'mine') sendAuctionMine(this.client, 0);
    else if (this.activeTab === 'bids') sendAuctionMine(this.client, 1);
    else if (this.activeTab === 'post') this.renderPostInventory();
  }

  private requestBrowse() {
    sendAuctionList(
      this.client,
      FILTER_TO_SEND[this.filter],
      this.browsePage,
      BROWSE_PAGE_SIZE,
      this.searchInput.value.trim(),
    );
  }

  private lastBrowsePage(): number {
    if (this.browseTotal <= 0) return 0;
    return Math.max(0, Math.ceil(this.browseTotal / BROWSE_PAGE_SIZE) - 1);
  }

  private renderPager() {
    // Pager is browse-only — Mine/Bids/Post tabs don't paginate.
    if (this.activeTab !== 'browse') {
      this.pagerEl.classList.add('hidden');
      return;
    }
    if (this.browseTotal <= BROWSE_PAGE_SIZE) {
      this.pagerEl.classList.add('hidden');
      return;
    }
    this.pagerEl.classList.remove('hidden');
    const last = this.lastBrowsePage();
    const startIdx = this.browsePage * BROWSE_PAGE_SIZE + 1;
    const endIdx = Math.min(
      this.browseTotal,
      (this.browsePage + 1) * BROWSE_PAGE_SIZE,
    );
    this.pagerInfo.textContent = `${startIdx.toLocaleString()}–${endIdx.toLocaleString()} of ${this.browseTotal.toLocaleString()}`;
    this.pagerPrev.disabled = this.browsePage <= 0;
    this.pagerNext.disabled = this.browsePage >= last;
  }

  private updateMeta() {
    if (!this.cfg) {
      this.meta.innerText = '';
      return;
    }
    this.meta.innerText = `${this.cfg.activeNow}/${this.cfg.maxActivePerAccount} listings`;
  }

  private renderList() {
    const rows =
      this.activeTab === 'browse'
        ? this.browseListings
        : this.activeTab === 'mine'
          ? this.myListings
          : this.activeTab === 'bids'
            ? this.myBids
            : [];

    this.listEl.innerHTML = '';
    this.renderedRows = [];
    // Any open inline-bid input was destroyed by clearing listEl. Reset
    // the lock here so a server reply that arrives mid-edit can't leave
    // the dialog permanently locked out of new bids and auto-refresh.
    this.inlineBidFor = null;

    if (!rows.length) {
      const empty = document.createElement('div');
      empty.className = 'ah-empty';
      empty.innerText =
        this.activeTab === 'browse'
          ? 'Nothing matches your filter. Try clearing the search or switching to All.'
          : this.activeTab === 'mine'
            ? "You haven't posted any auctions. Switch to Post New to list an item."
            : "You're not the high bidder on anything right now.";
      this.listEl.appendChild(empty);
      this.renderPager();
      return;
    }

    const nowMs = Date.now();
    for (const l of rows) {
      const { el, timeEl } = this.makeRow(l);
      this.listEl.appendChild(el);
      this.renderedRows.push({
        el,
        timeEl,
        expiresAtMs: nowMs + l.secsRemaining * 1000,
        listing: l,
      });
    }
    this.tickTimers();
    this.renderPager();
  }

  private isWinning(l: AuctionListing): boolean {
    // If we don't know our own name yet (very early in the session), bail
    // out — without this guard, an empty client.name would match the
    // empty currentBidder field on every un-bid auction and paint them
    // all "Winning."
    if (!this.client.name) return false;
    return (
      !!l.currentBidder &&
      l.currentBidder.toLowerCase() === this.client.name.toLowerCase()
    );
  }

  private makeRow(l: AuctionListing): {
    el: HTMLDivElement;
    timeEl: HTMLDivElement;
  } {
    const row = document.createElement('div');
    row.className = `ah-row ${l.listingType === AuctionListingType.InstantBuy ? 'ah-instant' : 'ah-auction'}`;
    row.dataset.id = l.id.toString();
    if (this.activeTab === 'browse' && this.isWinning(l)) {
      row.classList.add('ah-row-winning');
    }

    const iconWrap = document.createElement('div');
    iconWrap.className = 'ah-icon';
    const record = this.client.getEifRecordById(l.itemId);
    if (record) {
      const img = document.createElement('img');
      img.src = getItemGraphicPath(l.itemId, record.graphicId, l.quantity);
      img.draggable = false;
      iconWrap.appendChild(img);
    }
    row.appendChild(iconWrap);

    const info = document.createElement('div');
    info.className = 'ah-info';
    const name = document.createElement('div');
    name.className = 'ah-name';
    const qty = l.quantity > 1 ? ` ×${l.quantity}` : '';
    name.innerText = (record ? record.name : `Item ${l.itemId}`) + qty;
    info.appendChild(name);

    const price = document.createElement('div');
    price.className = 'ah-price';
    if (l.listingType === AuctionListingType.InstantBuy) {
      price.innerHTML = `<span class="ah-price-tag">${l.buyoutPrice.toLocaleString()}g</span>`;
    } else {
      const winning = this.isWinning(l);
      const bidLabel =
        l.currentBid > 0
          ? `Bid: <span class="${winning ? 'ah-price-mine' : 'ah-price-bid'}">${l.currentBid.toLocaleString()}g</span>`
          : `Start: <span class="ah-price-tag">${l.startPrice.toLocaleString()}g</span>`;
      const buyoutLabel =
        l.buyoutPrice > 0
          ? ` · Buyout: <span class="ah-price-buyout">${l.buyoutPrice.toLocaleString()}g</span>`
          : '';
      price.innerHTML = bidLabel + buyoutLabel;
    }
    info.appendChild(price);

    const time = document.createElement('div');
    time.className = 'ah-time';
    // Build with text nodes — `seller` and `currentBidder` are
    // player-controlled strings off the wire. Server validates names to
    // [a-z]{4,12} today, but we don't trust that contract on the client.
    const timeText = document.createElement('span');
    timeText.className = 'ah-time-text';
    timeText.textContent = formatTimeLeft(l.secsRemaining);
    time.appendChild(timeText);
    if (l.seller && this.activeTab === 'browse') {
      time.appendChild(document.createTextNode(` · ${l.seller}`));
    }
    if (
      this.activeTab === 'browse' &&
      l.listingType === AuctionListingType.Auction &&
      l.currentBid > 0 &&
      !this.isWinning(l) &&
      l.currentBidder
    ) {
      time.appendChild(document.createTextNode(` · led by ${l.currentBidder}`));
    }
    this.applyTimeUrgency(time, l.secsRemaining);
    info.appendChild(time);

    row.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'ah-actions';
    if (this.activeTab === 'mine') {
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'themed-btn';
      cancelBtn.type = 'button';
      cancelBtn.innerText = l.currentBid > 0 ? 'Has bids' : 'Cancel';
      cancelBtn.disabled = l.currentBid > 0;
      cancelBtn.title =
        l.currentBid > 0
          ? 'Auctions with bids cannot be cancelled.'
          : 'Cancel this listing (deposit forfeited).';
      cancelBtn.addEventListener('click', () => this.cancelListing(l));
      actions.appendChild(cancelBtn);
    } else if (this.isWinning(l)) {
      const winBadge = document.createElement('span');
      winBadge.className = 'ah-pill ah-pill-winning';
      winBadge.innerText = 'Winning';
      actions.appendChild(winBadge);
      // Buyout still allowed even when winning the bid — useful in PvP
      // with a buyout set, since you'd just pay buyout to lock it in.
      if (l.buyoutPrice > 0) {
        const buyBtn = document.createElement('button');
        buyBtn.className = 'themed-btn';
        buyBtn.type = 'button';
        buyBtn.innerText = 'Buy';
        buyBtn.title = `Pay ${l.buyoutPrice.toLocaleString()}g now and end the auction.`;
        buyBtn.addEventListener('click', () => this.buyout(l));
        actions.appendChild(buyBtn);
      }
    } else {
      if (l.buyoutPrice > 0) {
        const buyBtn = document.createElement('button');
        buyBtn.className = 'themed-btn';
        buyBtn.type = 'button';
        buyBtn.innerText = 'Buy';
        buyBtn.title = `Pay ${l.buyoutPrice.toLocaleString()}g now.`;
        buyBtn.addEventListener('click', () => this.buyout(l));
        actions.appendChild(buyBtn);
      }
      if (l.listingType === AuctionListingType.Auction) {
        const bidBtn = document.createElement('button');
        bidBtn.className = 'themed-btn';
        bidBtn.type = 'button';
        bidBtn.innerText = 'Bid';
        bidBtn.title = 'Place a bid on this auction.';
        bidBtn.addEventListener('click', () => this.openInlineBid(l, row));
        actions.appendChild(bidBtn);
      }
    }
    row.appendChild(actions);

    if (record) {
      this.attachHoverTooltip(row, record.name, getItemMeta(record));
    }

    return { el: row, timeEl: time };
  }

  private applyTimeUrgency(el: HTMLDivElement, secs: number) {
    el.classList.remove('ah-time-soon', 'ah-time-urgent');
    if (secs <= URGENT_THRESHOLD_SECS) el.classList.add('ah-time-urgent');
    else if (secs <= SOON_THRESHOLD_SECS) el.classList.add('ah-time-soon');
  }

  // Updates rendered timers in-place without rebuilding rows. Runs every
  // second while the dialog is shown.
  private tickTimers = () => {
    if (!this.renderedRows.length) return;
    const nowMs = Date.now();
    for (const r of this.renderedRows) {
      const remainingSecs = Math.max(
        0,
        Math.floor((r.expiresAtMs - nowMs) / 1000),
      );
      const span = r.timeEl.querySelector<HTMLSpanElement>('.ah-time-text');
      if (span) span.innerText = formatTimeLeft(remainingSecs);
      this.applyTimeUrgency(r.timeEl, remainingSecs);
    }
  };

  // ---------- Inline bid input ----------
  // Replaces the action buttons with a number input + Confirm/Cancel
  // inside the same row. Uses the existing bid-increment math to suggest a
  // minimum and prevents invalid values before sending.

  private openInlineBid(l: AuctionListing, row: HTMLDivElement) {
    if (!this.cfg) return;
    if (this.inlineBidFor !== null && this.inlineBidFor !== l.id) {
      // Collapse the previously-open inline editor in-place by re-rendering
      // its row from the cached listing data — avoids the async re-fetch
      // race where the new row reference would be stale before we mutated
      // its actions area.
      this.collapseInlineBid(this.inlineBidFor);
    }
    this.inlineBidFor = l.id;

    const min =
      l.currentBid > 0
        ? Math.max(
            l.currentBid + 1,
            Math.ceil(l.currentBid * (1 + this.cfg.bidIncrementPct / 100)),
          )
        : l.startPrice;

    const actions = row.querySelector<HTMLDivElement>('.ah-actions');
    if (!actions) return;
    actions.innerHTML = '';
    actions.classList.add('ah-actions-bidding');

    const input = document.createElement('input');
    input.type = 'number';
    input.min = String(min);
    input.value = String(min);
    input.className = 'ah-bid-input';
    input.title = `Minimum bid: ${min.toLocaleString()}g`;

    const confirm = document.createElement('button');
    confirm.className = 'themed-btn ah-bid-confirm';
    confirm.type = 'button';
    confirm.innerText = '✓';
    confirm.title = 'Place bid';

    const cancel = document.createElement('button');
    cancel.className = 'themed-btn ah-bid-cancel';
    cancel.type = 'button';
    cancel.innerText = '✕';
    cancel.title = 'Cancel bid';

    const submit = () => {
      const v = Number.parseInt(input.value, 10);
      if (!Number.isFinite(v) || v < min) {
        // Force animation replay by removing + reflowing + re-adding.
        input.classList.remove('ah-input-error');
        void input.offsetWidth;
        input.classList.add('ah-input-error');
        return;
      }
      input.classList.remove('ah-input-error');
      sendAuctionBid(this.client, l.id, v);
    };
    const close = () => {
      this.inlineBidFor = null;
      this.collapseInlineBid(l.id);
    };

    confirm.addEventListener('click', submit);
    cancel.addEventListener('click', close);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    });

    actions.appendChild(input);
    actions.appendChild(confirm);
    actions.appendChild(cancel);
    input.focus();
    input.select();
  }

  // Rebuild a single row from its cached listing — used to collapse the
  // inline-bid editor back to the normal Buy/Bid buttons without
  // round-tripping to the server (which would race the local DOM state).
  private collapseInlineBid(auctionId: number) {
    const idx = this.renderedRows.findIndex((r) => r.listing.id === auctionId);
    if (idx === -1) return;
    const old = this.renderedRows[idx]!;
    const remainingSecs = Math.max(
      0,
      Math.floor((old.expiresAtMs - Date.now()) / 1000),
    );
    const refreshed: AuctionListing = {
      ...old.listing,
      secsRemaining: remainingSecs,
    };
    const { el, timeEl } = this.makeRow(refreshed);
    old.el.replaceWith(el);
    this.renderedRows[idx] = {
      el,
      timeEl,
      expiresAtMs: old.expiresAtMs,
      listing: refreshed,
    };
  }

  // ---------- Buyout / Cancel via native confirm ----------

  private buyout(l: AuctionListing) {
    const record = this.client.getEifRecordById(l.itemId);
    const itemLabel = record ? record.name : `item #${l.itemId}`;
    const qtyLabel = l.quantity > 1 ? ` ×${l.quantity}` : '';
    this.client.emit('confirmation', {
      title: 'Buy out auction',
      message: `Pay ${l.buyoutPrice.toLocaleString()} gold for ${itemLabel}${qtyLabel}?\nThe item will land in your delivery inbox.`,
      onConfirm: () => sendAuctionBuyout(this.client, l.id),
    });
  }

  private cancelListing(l: AuctionListing) {
    if (l.currentBid > 0) return;
    this.client.emit('confirmation', {
      title: 'Cancel listing',
      message: `Cancel auction #${l.id}? Your deposit will be forfeit.\nThe item returns to your delivery inbox.`,
      onConfirm: () => sendAuctionCancel(this.client, l.id),
    });
  }

  // ---------- Hover tooltip ----------

  private ensureTooltip(): HTMLDivElement {
    if (this.tooltip) return this.tooltip;
    const t = document.createElement('div');
    t.className = 'ah-tooltip';
    document.body.appendChild(t);
    this.tooltip = t;
    return t;
  }

  private attachHoverTooltip(el: HTMLElement, name: string, meta: string[]) {
    const lines = [name, ...meta];
    el.addEventListener('mouseenter', () => {
      const t = this.ensureTooltip();
      t.innerText = lines.join('\n');
      t.classList.add('visible');
    });
    el.addEventListener('mouseleave', () => {
      if (this.tooltip) this.tooltip.classList.remove('visible');
    });
    el.addEventListener('mousemove', (e) => {
      if (!this.tooltip) return;
      const uiEl = document.getElementById('ui');
      const m = uiEl?.style.transform.match(/scale\(([^)]+)\)/);
      const scale = m ? Number.parseFloat(m[1]) : 1;
      this.tooltip.style.left = `${(e.clientX + 14) / scale}px`;
      this.tooltip.style.top = `${(e.clientY + 14) / scale}px`;
    });
  }

  // ---------- Post-new tab ----------

  private bindPostForm() {
    const inputQty =
      this.postForm.querySelector<HTMLInputElement>('input[name="qty"]')!;
    inputQty.addEventListener('input', () => this.renderPostSummary());

    for (const r of this.postForm.querySelectorAll<HTMLInputElement>(
      'input[name="type"]',
    )) {
      r.addEventListener('change', () => {
        this.postType = r.checked && r.value === 'auction' ? 1 : 0;
        const startWrap = this.postForm.querySelector<HTMLLabelElement>(
          'label[data-field="start"]',
        );
        if (startWrap) {
          startWrap.classList.toggle('hidden', this.postType !== 1);
        }
        const buyoutLabel = this.postForm.querySelector<HTMLSpanElement>(
          'label[data-field="buyout"] .ah-field-label',
        );
        if (buyoutLabel) {
          buyoutLabel.innerText =
            this.postType === 1 ? 'Buyout (optional)' : 'Price';
        }
        this.renderPostSummary();
      });
    }

    for (const r of this.postForm.querySelectorAll<HTMLInputElement>(
      'input[name="duration"]',
    )) {
      r.addEventListener('change', () => {
        this.postDuration = Number.parseInt(r.value, 10) as DurationIdx;
        this.renderPostSummary();
      });
    }

    const inputStart = this.postForm.querySelector<HTMLInputElement>(
      'input[name="start"]',
    )!;
    inputStart.addEventListener('input', () => this.renderPostSummary());

    const inputBuyout = this.postForm.querySelector<HTMLInputElement>(
      'input[name="buyout"]',
    )!;
    inputBuyout.addEventListener('input', () => this.renderPostSummary());

    this.postForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitPost();
    });

    const changeBtn = this.postForm.querySelector<HTMLButtonElement>(
      'button[data-id="change-item"]',
    );
    changeBtn?.addEventListener('click', () => {
      // Full reset — without this the user's prior listing type and
      // prices stay populated when they pick a different item, which is
      // confusing and can lead to a price-mismatched submit.
      this.resetPostForm();
      this.renderPostInventory();
      this.renderPostSummary();
    });
  }

  private resetPostForm() {
    this.postSelectedItemId = 0;
    this.postType = 0;
    this.postDuration = 1;
    const inputQty =
      this.postForm.querySelector<HTMLInputElement>('input[name="qty"]');
    if (inputQty) inputQty.value = '1';
    const inputStart = this.postForm.querySelector<HTMLInputElement>(
      'input[name="start"]',
    );
    if (inputStart) inputStart.value = '';
    const inputBuyout = this.postForm.querySelector<HTMLInputElement>(
      'input[name="buyout"]',
    );
    if (inputBuyout) inputBuyout.value = '';
    const radioInstant = this.postForm.querySelector<HTMLInputElement>(
      'input[name="type"][value="instant"]',
    );
    if (radioInstant) radioInstant.checked = true;
    const radioMedium = this.postForm.querySelector<HTMLInputElement>(
      'input[name="duration"][value="1"]',
    );
    if (radioMedium) radioMedium.checked = true;
    const startWrap = this.postForm.querySelector<HTMLLabelElement>(
      'label[data-field="start"]',
    );
    startWrap?.classList.add('hidden');
  }

  private renderPostInventory() {
    const banner =
      this.postForm.querySelector<HTMLDivElement>('.ah-post-banner');
    const picker = this.postForm.querySelector<HTMLDivElement>(
      '.ah-inventory-picker',
    );
    const detailsWrap =
      this.postForm.querySelector<HTMLDivElement>('.ah-post-details');
    if (!banner || !picker || !detailsWrap) return;

    if (this.postSelectedItemId === 0) {
      banner.classList.add('hidden');
      picker.classList.remove('hidden');
      detailsWrap.classList.add('hidden');
      picker.innerHTML = '';
      const items = this.client.items.filter((i) => i.id !== 1 && i.amount > 0);
      if (!items.length) {
        const empty = document.createElement('div');
        empty.className = 'ah-empty';
        empty.style.gridColumn = '1 / -1';
        empty.innerText =
          'No tradeable items in your inventory. Pick up something first.';
        picker.appendChild(empty);
        return;
      }
      for (const inv of items) {
        const record = this.client.getEifRecordById(inv.id);
        if (!record) continue;
        const cell = document.createElement('div');
        cell.className = 'ah-inv-cell';
        cell.title = record.name;
        const img = document.createElement('img');
        img.src = getItemGraphicPath(inv.id, record.graphicId, inv.amount);
        img.draggable = false;
        cell.appendChild(img);
        const amt = document.createElement('span');
        amt.className = 'ah-inv-amount';
        amt.innerText = `×${inv.amount.toLocaleString()}`;
        cell.appendChild(amt);
        this.attachHoverTooltip(cell, record.name, getItemMeta(record));
        cell.addEventListener('click', () => {
          this.postSelectedItemId = inv.id;
          sendAuctionPriceQuery(this.client, inv.id);
          this.renderPostInventory();
          this.renderPostSummary();
        });
        picker.appendChild(cell);
      }
      return;
    }

    // An item is selected — show banner + form details, hide picker grid.
    banner.classList.remove('hidden');
    picker.classList.add('hidden');
    detailsWrap.classList.remove('hidden');

    const inv = this.client.items.find((i) => i.id === this.postSelectedItemId);
    const record = inv ? this.client.getEifRecordById(inv.id) : undefined;
    const bannerImg = banner.querySelector<HTMLImageElement>('.ah-banner-img');
    const bannerName = banner.querySelector<HTMLSpanElement>('.ah-banner-name');
    const bannerMeta = banner.querySelector<HTMLSpanElement>('.ah-banner-meta');
    if (bannerImg && record && inv) {
      bannerImg.src = getItemGraphicPath(inv.id, record.graphicId, inv.amount);
    }
    if (bannerName) {
      bannerName.innerText = record
        ? record.name
        : `Item #${this.postSelectedItemId}`;
    }
    if (bannerMeta && inv) {
      bannerMeta.innerText = `Have: ×${inv.amount.toLocaleString()}`;
    }
    const inputQty =
      this.postForm.querySelector<HTMLInputElement>('input[name="qty"]');
    if (inputQty && inv) inputQty.max = String(inv.amount);
  }

  private renderPostSummary() {
    const summary =
      this.postForm.querySelector<HTMLDivElement>('.ah-summary-line');
    const errorEl = this.postForm.querySelector<HTMLDivElement>('.ah-error')!;
    errorEl.innerText = '';

    if (!summary) return;
    if (!this.cfg || !this.postSelectedItemId) {
      summary.innerText = '';
      return;
    }
    const inv = this.client.items.find((i) => i.id === this.postSelectedItemId);
    if (!inv) {
      summary.innerText = '';
      return;
    }
    const startPrice = this.readPostPrice('start');
    const buyoutPrice = this.readPostPrice('buyout');
    const referencePrice = this.postType === 1 ? startPrice : buyoutPrice;
    const durMult = [1, 2, 4][this.postDuration] ?? 1;
    const deposit = Math.max(
      1,
      Math.floor(((referencePrice ?? 0) * this.cfg.depositPct) / 100) * durMult,
    );
    const grossExpected = referencePrice ?? 0;
    const cut = Math.floor((grossExpected * this.cfg.saleCutPct) / 100);
    const netIfSold = grossExpected - cut + deposit;

    const priceInfo = this.postPriceCache.get(this.postSelectedItemId);
    const lines: string[] = [];
    lines.push(
      `Deposit ${deposit.toLocaleString()}g · cut ${this.cfg.saleCutPct}% · net if sold: ${netIfSold.toLocaleString()}g`,
    );
    if (priceInfo && priceInfo.sampleCount > 0) {
      lines.push(
        `Recent: avg ${Math.round(priceInfo.avgUnitPrice).toLocaleString()}g/ea (${priceInfo.sampleCount} sale${priceInfo.sampleCount === 1 ? '' : 's'} in last week)`,
      );
    } else {
      lines.push('No recent sales — set a price you think is fair.');
    }
    summary.innerText = lines.join('\n');
  }

  private readPostPrice(name: 'start' | 'buyout'): number {
    const el = this.postForm.querySelector<HTMLInputElement>(
      `input[name="${name}"]`,
    );
    if (!el) return 0;
    const v = Number.parseInt(el.value, 10);
    return Number.isFinite(v) && v > 0 ? v : 0;
  }

  private readPostQuantity(): number {
    const el =
      this.postForm.querySelector<HTMLInputElement>('input[name="qty"]')!;
    const v = Number.parseInt(el.value, 10);
    return Number.isFinite(v) && v > 0 ? v : 1;
  }

  private submitPost() {
    if (!this.cfg) return;
    const errorEl = this.postForm.querySelector<HTMLDivElement>('.ah-error')!;
    errorEl.innerText = '';
    if (!this.postSelectedItemId) {
      errorEl.innerText = 'Pick an item to list.';
      return;
    }
    const qty = this.readPostQuantity();
    const inv = this.client.items.find((i) => i.id === this.postSelectedItemId);
    if (!inv || inv.amount < qty) {
      errorEl.innerText = "You don't have that many of that item.";
      return;
    }
    const startPrice = this.postType === 1 ? this.readPostPrice('start') : 0;
    const buyoutPrice = this.readPostPrice('buyout');
    if (this.postType === 0 && buyoutPrice < this.cfg.minStartPrice) {
      errorEl.innerText = `Buyout must be at least ${this.cfg.minStartPrice}g.`;
      return;
    }
    if (this.postType === 1 && startPrice < this.cfg.minStartPrice) {
      errorEl.innerText = `Start price must be at least ${this.cfg.minStartPrice}g.`;
      return;
    }
    if (this.postType === 1 && buyoutPrice > 0 && buyoutPrice < startPrice) {
      errorEl.innerText = 'Buyout must be ≥ start price.';
      return;
    }

    sendAuctionPost(
      this.client,
      this.postSelectedItemId,
      qty,
      this.postType,
      startPrice,
      buyoutPrice,
      this.postDuration,
    );
  }

  show() {
    this.container.classList.remove('hidden');
    this.dialogs.classList.remove('hidden');
    this.client.typing = true;
    addMobileCloseButton(this.container, () => this.hide());
    if (this.tickHandle === null) {
      this.tickHandle = window.setInterval(this.tickTimers, 1000);
    }
    if (this.autoRefreshHandle === null) {
      this.autoRefreshHandle = window.setInterval(() => {
        // Don't auto-refresh during inline-bid edits or post-form drafting,
        // since refreshing rebuilds the row and would lose the input state.
        if (this.inlineBidFor !== null) return;
        if (this.activeTab === 'post') return;
        this.refreshActiveTab();
      }, AUTO_REFRESH_MS);
    }
    if (this.hiddenObserver === null) {
      this.hiddenObserver = new MutationObserver(() => {
        if (this.container.classList.contains('hidden')) {
          // Re-enter our normal hide path so intervals get cleared and
          // client.typing flips back. Idempotent if hide() was the cause.
          this.hide();
        }
      });
      this.hiddenObserver.observe(this.container, {
        attributes: true,
        attributeFilter: ['class'],
      });
    }
  }

  hide() {
    // Disconnect the observer FIRST so adding `.hidden` below doesn't
    // re-trigger this method via the mutation callback.
    if (this.hiddenObserver !== null) {
      this.hiddenObserver.disconnect();
      this.hiddenObserver = null;
    }
    this.container.classList.add('hidden');
    if (this.tickHandle !== null) {
      window.clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
    if (this.autoRefreshHandle !== null) {
      window.clearInterval(this.autoRefreshHandle);
      this.autoRefreshHandle = null;
    }
    this.inlineBidFor = null;
    if (this.tooltip) {
      this.tooltip.classList.remove('visible');
    }
    if (!document.querySelector('#dialogs > div:not(.hidden)')) {
      this.dialogs.classList.add('hidden');
      this.client.typing = false;
    }
  }
}
