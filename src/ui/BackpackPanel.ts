/**
 * Magic Backpack DOM 面板。
 *
 * 面板只负责查询、渲染和转发意图，不直接生成 Phaser 实体；主线程通过回调接线。
 */

import { ObjectLibrary, type ObjectLibraryItem, type ObjectLibrarySort } from '@/game/ObjectLibrary';
import { getLang } from '@/core/i18n/I18n';
import { ICON_BACKPACK, ICON_CLOSE, ICON_EDIT, ICON_TRASH } from './icons';
import { UI_FONT, PAPER_BG, PAPER_BG_ALT, INK, PAPER_SHADOW, TORN_EDGE } from './paperStyle';

export interface BackpackPanelCallbacks {
  /** 主线程将 typeId 交给 ObjectLibrary.getSpawnCandidate 后生成。 */
  onSpawn: (typeId: string) => void;
  onEdit?: (typeId: string) => void | Promise<void>;
  onDuplicate?: (typeId: string) => void | Promise<void>;
  onDelete?: (typeId: string) => void | Promise<void>;
}

export class BackpackPanel {
  private readonly el: HTMLDivElement;
  private readonly listEl: HTMLDivElement;
  private readonly searchInput: HTMLInputElement;
  private readonly favoriteOnlyInput: HTMLInputElement;
  private readonly sortSelect: HTMLSelectElement;
  private visible = false;

  constructor(private readonly library: ObjectLibrary, private readonly cb: BackpackPanelCallbacks) {
    this.el = document.createElement('div');
    this.el.id = 'backpack-panel';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', '魔法背包');
    this.el.style.cssText = panelStyle();

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px';
    const heading = document.createElement('div');
    heading.innerHTML = `${ICON_BACKPACK}<span style="margin-left:7px;font-weight:900;vertical-align:middle">魔法背包</span>`;
    const close = document.createElement('button');
    close.type = 'button';
    close.innerHTML = ICON_CLOSE;
    close.title = '关闭魔法背包';
    close.setAttribute('aria-label', '关闭魔法背包');
    close.style.cssText = closeStyle();
    close.addEventListener('click', () => this.hide());
    header.append(heading, close);

    const controls = document.createElement('div');
    controls.style.cssText = 'display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;align-items:center';
    this.searchInput = document.createElement('input');
    this.searchInput.type = 'search';
    this.searchInput.placeholder = '搜索中英文名称或别名';
    this.searchInput.setAttribute('aria-label', '搜索背包');
    this.searchInput.style.cssText = inputStyle();
    this.searchInput.addEventListener('input', () => void this.refresh());

    this.sortSelect = document.createElement('select');
    this.sortSelect.setAttribute('aria-label', '背包排序');
    this.sortSelect.style.cssText = inputStyle();
    addOption(this.sortSelect, 'recent', '最近使用');
    addOption(this.sortSelect, 'frequent', '使用频率');
    addOption(this.sortSelect, 'name', '名称');
    this.sortSelect.addEventListener('change', () => void this.refresh());
    controls.append(this.searchInput, this.sortSelect);

    const filter = document.createElement('label');
    filter.style.cssText = `display:flex;align-items:center;gap:6px;font-size:12px;color:${INK};cursor:pointer`;
    this.favoriteOnlyInput = document.createElement('input');
    this.favoriteOnlyInput.type = 'checkbox';
    this.favoriteOnlyInput.addEventListener('change', () => void this.refresh());
    filter.append(this.favoriteOnlyInput, document.createTextNode('只看收藏'));

    this.listEl = document.createElement('div');
    this.listEl.id = 'backpack-list';
    this.listEl.style.cssText = 'display:flex;flex-direction:column;gap:7px;max-height:min(52vh,420px);overflow:auto';

    this.el.append(header, controls, filter, this.listEl);
    this.el.style.display = 'none';
    document.body.appendChild(this.el);
  }

  async show(): Promise<void> {
    this.visible = true;
    this.el.style.display = 'block';
    await this.refresh();
    this.searchInput.focus();
  }

  hide(): void {
    this.visible = false;
    this.el.style.display = 'none';
  }

  async toggle(): Promise<void> {
    if (this.visible) this.hide();
    else await this.show();
  }

  async refresh(): Promise<void> {
    const sort = this.sortSelect.value as ObjectLibrarySort;
    const items = await this.library.list({
      search: this.searchInput.value,
      favoritesOnly: this.favoriteOnlyInput.checked,
      sort,
    });
    this.render(items);
  }

  /** 公开渲染入口，便于宿主或纯 DOM 测试使用。 */
  render(items: ObjectLibraryItem[]): void {
    this.listEl.innerHTML = '';
    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = '还没有记录。召唤物体后，它会出现在这里。';
      empty.style.cssText = `padding:18px 10px;text-align:center;font-size:12px;color:${INK};opacity:0.65`;
      this.listEl.appendChild(empty);
      return;
    }
    for (const item of items) this.listEl.appendChild(this.createItem(item));
  }

  private createItem(item: ObjectLibraryItem): HTMLDivElement {
    const row = document.createElement('div');
    row.dataset.typeId = item.typeId;
    row.style.cssText = `display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:9px 10px;background:${PAPER_BG_ALT};border-radius:7px`;

    const info = document.createElement('div');
    info.style.cssText = 'min-width:0';
    const name = document.createElement('div');
    name.textContent = getLang() === 'zh' ? item.zh.name : item.en.name;
    name.style.cssText = `font-size:15px;font-weight:900;color:${INK};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`;
    const secondary = document.createElement('div');
    secondary.textContent = `${item.en.name} · ${item.record.useCount} 次${item.isCustom ? ' · 自定义' : ''}`;
    secondary.style.cssText = 'font-size:11px;color:rgba(43,43,43,0.62);white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
    info.append(name, secondary);

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;align-items:center;gap:4px';
    actions.appendChild(this.actionButton(item.record.favorite ? '已收藏' : '收藏', () => void this.toggleFavorite(item.typeId)));
    actions.appendChild(this.actionButton('生成', () => this.cb.onSpawn(item.typeId), true));
    if (item.isCustom && this.cb.onEdit) {
      actions.appendChild(this.actionButton(ICON_EDIT, () => void this.cb.onEdit?.(item.typeId), false, '编辑'));
    }
    if (item.isCustom && this.cb.onDuplicate) {
      actions.appendChild(this.actionButton('复制', () => void this.cb.onDuplicate?.(item.typeId), false, '复制'));
    }
    if (item.isCustom && this.cb.onDelete) {
      actions.appendChild(this.actionButton(ICON_TRASH, () => void this.cb.onDelete?.(item.typeId), false, '删除'));
    }
    row.append(info, actions);
    return row;
  }

  private async toggleFavorite(typeId: string): Promise<void> {
    await this.library.toggleFavorite(typeId);
    await this.refresh();
  }

  private actionButton(
    label: string,
    onClick: () => void,
    primary = false,
    ariaLabel = label,
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.innerHTML = label.startsWith('<svg') ? label : '';
    if (!button.innerHTML) button.textContent = label;
    button.setAttribute('aria-label', ariaLabel);
    button.style.cssText = actionStyle(primary);
    button.addEventListener('click', (event) => {
      event.preventDefault();
      onClick();
    });
    return button;
  }
}

function addOption(select: HTMLSelectElement, value: ObjectLibrarySort, text: string): void {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = text;
  select.appendChild(option);
}

function panelStyle(): string {
  return [
    'position:fixed',
    'top:max(60px,env(safe-area-inset-top))',
    'right:18px',
    'width:min(430px,calc(100vw - 32px))',
    'box-sizing:border-box',
    'padding:15px',
    `background:${PAPER_BG}`,
    `box-shadow:${PAPER_SHADOW}`,
    `color:${INK}`,
    `font-family:${UI_FONT}`,
    TORN_EDGE,
    'transform:rotate(-0.4deg)',
    'z-index:51',
  ].join(';');
}

function inputStyle(): string {
  return [
    'width:100%',
    'box-sizing:border-box',
    'padding:7px 9px',
    'border:1px solid rgba(43,43,43,0.28)',
    'border-radius:6px',
    `background:${PAPER_BG_ALT}`,
    `color:${INK}`,
    `font-family:${UI_FONT}`,
    'font-size:12px',
    'outline:none',
  ].join(';');
}

function closeStyle(): string {
  return `width:28px;height:28px;padding:0;border:0;border-radius:50%;background:transparent;color:${INK};cursor:pointer`;
}

function actionStyle(primary: boolean): string {
  return [
    'min-width:30px',
    'min-height:28px',
    'padding:4px 7px',
    'border-radius:5px',
    'border:1px solid rgba(43,43,43,0.25)',
    `background:${primary ? INK : 'transparent'}`,
    `color:${primary ? PAPER_BG : INK}`,
    `font-family:${UI_FONT}`,
    'font-size:11px',
    'font-weight:800',
    'cursor:pointer',
  ].join(';');
}
