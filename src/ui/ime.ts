/**
 * IME 控制器 —— 集中处理中文输入法合成态。
 *
 * 合成期不触发解析与补全；compositionend 后才解析。
 * 跨浏览器/输入法差异用 isComposing 防御。
 */

export interface ImeCallbacks {
  onComposeStart: () => void;
  onComposeUpdate: (text: string) => void;
  onComposeEnd: (finalText: string) => void;
}

export class ImeController {
  private composing = false;
  private readonly cbs: ImeCallbacks;

  constructor(cbs: ImeCallbacks) {
    this.cbs = cbs;
  }

  attach(input: HTMLInputElement): void {
    input.addEventListener('compositionstart', () => {
      this.composing = true;
      this.cbs.onComposeStart();
    });
    input.addEventListener('compositionupdate', (e) => {
      if (!this.composing) return;
      this.cbs.onComposeUpdate((e as CompositionEvent).data);
    });
    input.addEventListener('compositionend', (e) => {
      this.composing = false;
      this.cbs.onComposeEnd((e as CompositionEvent).data);
    });
  }

  get isComposing(): boolean {
    return this.composing;
  }
}
