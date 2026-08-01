/**
 * 附着/组合 —— 多个实体用刚性 constraint 连接为一个组合体。
 *
 * "带轮子的狗" = 狗 body + 若干 wheel body，经 stiffness=1、length=0 的
 * Matter Constraint 刚性连接。child 仍为独立实体，可独立被形容词修改/被破坏。
 *
 * 设计原则：附着是物理层的约束关系，不改变实体独立性。
 */

import type { Physics } from '@/engine/physics/Physics';
import type { GameEntity } from '@/game/Entity';

export interface Attachment {
  parentId: string;
  childId: string;
  constraint: MatterJS.ConstraintType;
}

/**
 * 把 child 附着到 parent 的指定锚点（相对 parent 中心的本地坐标）。
 *
 * childAnchor 用于“手握物体”这类非质心绑定：例如手枪的握把不在精灵
 * 中心，约束应绑定握把而不是把整把枪的中心塞进手里。
 */
export function attach(
  physics: Physics,
  parent: GameEntity,
  child: GameEntity,
  anchor: [number, number],
  childAnchor: [number, number] = [0, 0],
): Attachment {
  const constraint = physics.createConstraint(parent.body, child.body, 0, 1, {
    pointA: { x: anchor[0], y: anchor[1] },
    pointB: { x: childAnchor[0], y: childAnchor[1] },
  });
  return { parentId: parent.id, childId: child.id, constraint };
}

/** 解除附着 */
export function detach(physics: Physics, attachment: Attachment): void {
  physics.removeConstraint(attachment.constraint);
}
