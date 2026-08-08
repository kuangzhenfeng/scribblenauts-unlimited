/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest';
import { SpeechBubble } from '@/ui/SpeechBubble';

afterEach(() => {
  document.body.innerHTML = '';
  document.head.querySelector('#speech-bubble-layout-style')?.remove();
});

describe('SpeechBubble', () => {
  it('以双层挑战气泡结构渲染文本和笔记本入口', () => {
    const bubble = new SpeechBubble();

    bubble.show('桥卫：先搬来木头。', '靠近桥头即可完成');
    bubble.positionAt(100, 200, {
      cam: { scrollX: 0, scrollY: 0, zoom: 1, x: 0, y: 0 },
      worldToScreen: (x: number, y: number) => ({ x, y }),
    } as never);

    const root = document.querySelector<HTMLElement>('#speech-bubble');
    expect(root?.dataset.placement).toBe('above');
    expect(root?.style.display).toBe('block');
    expect(root?.querySelector('.speech-bubble__text')?.textContent).toBe('桥卫：先搬来木头。');
    expect(root?.querySelector('.speech-bubble__cue')).not.toBeNull();
    expect(document.body.dataset.speechBubbleActive).toBe('true');

    bubble.hide();
    expect(root?.style.display).toBe('none');
    expect(document.body.dataset.speechBubbleActive).toBeUndefined();
  });

  it('按 NPC 世界坐标定位，避免固定在视口底部遮挡人物', () => {
    const bubble = new SpeechBubble();

    bubble.show('园丁：先找两朵花。');
    bubble.positionAt(320, 220, {
      cam: { scrollX: 0, scrollY: 0, zoom: 1, x: 0, y: 0 },
      worldToScreen: (x: number, y: number) => ({ x, y }),
    } as never);

    const root = document.querySelector<HTMLElement>('#speech-bubble');
    expect(root?.dataset.placement).toBe('above');
    expect(root?.style.left).toBe('320px');
    expect(root?.style.top).toBe('124px');
    expect(root?.style.bottom).toBe('');
  });
});
