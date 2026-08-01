/**
 * 确认对话框 —— 纸片风格轻量模态。
 *
 * 替代 window.confirm（系统弹窗与项目纸片 UI 风格冲突）。
 * 半透明遮罩 + 纸张卡片 + 「确认/取消」两按钮，确认按钮警示色（橙红）。
 * ESC / 点遮罩 = 取消；关闭后自动从 DOM 移除。
 */

import { UI_FONT, PAPER_BG, INK, TORN_EDGE, PAPER_SHADOW } from './paperStyle';
import { t } from '@/core/i18n/I18n';

export interface ConfirmOptions {
  title: string;
  message: string;
  /** 确认按钮文案，默认 t('common.confirm') */
  confirmText?: string;
  /** 取消按钮文案，默认 t('common.cancel') */
  cancelText?: string;
}

let dialogCount = 0;

/**
 * 弹出确认对话框，返回用户是否点击确认。
 * 调用方 await 此函数即可；无论确认/取消，对话框都会自行移除。
 */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;

    const overlay = document.createElement('div');
    dialogCount += 1;
    const titleId = `confirm-dialog-title-${dialogCount}`;
    const messageId = `confirm-dialog-message-${dialogCount}`;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', titleId);
    overlay.setAttribute('aria-describedby', messageId);
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:200',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'padding:16px',
      'box-sizing:border-box',
      'background:rgba(20,12,4,0.45)',
      'pointer-events:auto',
      'animation:confirmFadeIn 0.16s ease',
    ].join(';');

    const card = document.createElement('div');
    card.setAttribute('role', 'document');
    card.style.cssText = [
      'position:relative',
      `background:${PAPER_BG}`,
      `box-shadow:${PAPER_SHADOW}`,
      TORN_EDGE,
      `color:${INK}`,
      `font-family:${UI_FONT}`,
      'padding:24px 26px 22px',
      'max-width:380px',
      'width:calc(100% - 48px)',
      'display:flex',
      'flex-direction:column',
      'gap:14px',
    ].join(';');

    const title = document.createElement('div');
    title.id = titleId;
    title.textContent = opts.title;
    title.style.cssText = ['font-size:22px', 'font-weight:900', 'letter-spacing:0.04em', `color:${INK}`].join(';');
    card.appendChild(title);

    const msg = document.createElement('div');
    msg.id = messageId;
    msg.textContent = opts.message;
    msg.style.cssText = ['font-size:15px', 'line-height:1.5', 'color:rgba(43,43,43,0.78)'].join(';');
    card.appendChild(msg);

    const btnRow = document.createElement('div');
    btnRow.style.cssText = ['display:flex', 'gap:10px', 'justify-content:flex-end', 'margin-top:4px'].join(';');

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = opts.cancelText ?? t('common.cancel');
    cancel.style.cssText = [
      'min-height:44px',
      'padding:9px 18px',
      `font-family:${UI_FONT}`,
      'font-size:15px',
      'font-weight:700',
      `color:${INK}`,
      `background:${PAPER_BG}`,
      `border:2px solid rgba(43,43,43,0.4)`,
      'border-radius:8px',
      'cursor:pointer',
      'transition:transform 0.12s ease,background 0.12s ease',
    ].join(';');

    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.textContent = opts.confirmText ?? t('common.confirm');
    confirm.style.cssText = [
      'min-height:44px',
      'padding:9px 18px',
      `font-family:${UI_FONT}`,
      'font-size:15px',
      'font-weight:900',
      'color:#fff8dd',
      'background:#a53918',
      'border:1px solid #5a1a04',
      'border-radius:8px',
      'cursor:pointer',
      'box-shadow:0 3px 0 #7a2306',
      'transition:transform 0.12s ease,filter 0.12s ease',
    ].join(';');

    btnRow.appendChild(cancel);
    btnRow.appendChild(confirm);
    card.appendChild(btnRow);
    overlay.appendChild(card);

    // 入场动画样式（只注一次）
    if (!document.getElementById('confirm-anim-style')) {
      const style = document.createElement('style');
      style.id = 'confirm-anim-style';
      style.textContent = `
        @keyframes confirmFadeIn { from{opacity:0} to{opacity:1} }
        @keyframes confirmPop { from{opacity:0;transform:scale(0.96)} to{opacity:1;transform:scale(1)} }
        [role="dialog"] button:focus-visible { outline:3px solid #f0bd3c;outline-offset:3px; }
        @media (prefers-reduced-motion:reduce) { [role="dialog"], [role="dialog"] * { animation:none !important;transition:none !important; } }
      `;
      document.head.appendChild(style);
    }
    card.style.animation = 'confirmPop 0.18s ease';

    let cleanup = (): void => undefined;
    const finish = (result: boolean): void => {
      if (settled) return;
      settled = true;
      cleanup();
      overlay.style.transition = 'opacity 0.14s ease';
      overlay.style.opacity = '0';
      window.setTimeout(() => overlay.remove(), 150);
      resolve(result);
    };

    cancel.addEventListener('click', (e) => { e.stopPropagation(); finish(false); });
    confirm.addEventListener('click', (e) => { e.stopPropagation(); finish(true); });
    card.addEventListener('click', (e) => e.stopPropagation());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish(false);
    });

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.stopPropagation(); finish(false); }
      else if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Tab') {
        const focusables = [cancel, confirm];
        const index = focusables.indexOf(document.activeElement as HTMLButtonElement);
        const next = e.shiftKey ? (index <= 0 ? focusables.length - 1 : index - 1) : (index + 1) % focusables.length;
        e.preventDefault();
        focusables[next]?.focus();
      }
    };
    document.addEventListener('keydown', onKey, { once: false });
    cleanup = () => document.removeEventListener('keydown', onKey);

    document.body.appendChild(overlay);
    // 确认按钮默认聚焦，便于回车确认
    confirm.focus();
  });
}
