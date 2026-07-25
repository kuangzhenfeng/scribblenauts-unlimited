/**
 * 基础渲染器统一注册 —— WorldScene create 时调用一次。
 *
 * 每个渲染器对应一种矢量绘制模板；词条 appearance 通过 renderer 引用。
 */

import { registerRenderer } from '../registry';
import { box } from './box';
import { quadruped } from './quadruped';
import { biped } from './biped';
import { maxwell } from './maxwell';
import { starite } from './starite';
import { tentacled } from './tentacled';
import { bird } from './bird';
import { fish } from './fish';
import { fire } from './fire';
import { water } from './water';
import { steam } from './steam';
import { rope } from './rope';
import { stone } from './stone';
import { apple } from './apple';
import { meat } from './meat';
import { sword } from './sword';
import { knife } from './knife';
import { gun } from './gun';
import { tree } from './tree';
import { car } from './car';
import { wheel } from './wheel';
import { registerDecorRenderers } from './decor';

export function registerAllRenderers(): void {
  registerRenderer('box', box);
  registerRenderer('quadruped', quadruped);
  registerRenderer('biped', biped);
  registerRenderer('maxwell', maxwell);
  registerRenderer('starite', starite);
  registerRenderer('tentacled', tentacled);
  registerRenderer('bird', bird);
  registerRenderer('fish', fish);
  registerRenderer('fire', fire);
  registerRenderer('water', water);
  registerRenderer('steam', steam);
  registerRenderer('rope', rope);
  registerRenderer('stone', stone);
  registerRenderer('apple', apple);
  registerRenderer('meat', meat);
  registerRenderer('sword', sword);
  registerRenderer('knife', knife);
  registerRenderer('gun', gun);
  registerRenderer('tree', tree);
  registerRenderer('car', car);
  registerRenderer('wheel', wheel);
  registerDecorRenderers();
}
