/**
 * 矢量渲染器注册表 —— 渲染器 id → VectorRenderer 的全局映射（强类型）。
 *
 * 各 base renderer（box / quadruped / fire ...）在加载时调用 registerRenderer 注册。
 * Renderer 绘制时按实体 rendererId 查表调用。
 *
 * 与旧项目差异：词条 appearance.renderer 统一为渲染器 id 字符串，
 * RenderRegistry 强类型映射，数据层引用渲染器用 const 键，编译期可查。
 */

import type { VectorRenderer } from './VectorDraw';

const registry = new Map<string, VectorRenderer>();

export function registerRenderer(id: string, renderer: VectorRenderer): void {
  registry.set(id, renderer);
}

export function getRenderer(id: string): VectorRenderer | undefined {
  return registry.get(id);
}
