/**
 * 世界场景 —— Phase 5：完整玩法闭环。
 *
 * WorldScene.update 调度链：输入 → 物理步进（Phaser 接管）→ 规则 update → 行为更新
 * → respawn 检查 → 目标评估 → 对话更新 → 关卡切换检查 → animTime 累加 → 相机跟随 → 渲染同步。
 * 装配 Notebook/Hud/ProgressPanel/SpeechBubble/ObjectEditorUi/MousePicker/PlayerController/
 * LevelManager/BehaviorSystem/GoalSystem/DialogSystem。
 */

import Phaser from 'phaser';
import { Physics } from '@/engine/physics/Physics';
import { EntityManager } from '@/game/EntityManager';
import { TagIndex } from '@/core/rules/TagIndex';
import { RuleEngine } from '@/core/rules/RuleEngine';
import { rules } from '@/core/data/dictionary/rules/rules';
import { Spawner } from '@/game/Spawner';
import { Camera } from '@/engine/render/Camera';
import { createEntityGraphics, syncGraphics, drawHighlight } from '@/engine/render/EntityGraphics';
import { Environment } from '@/engine/render/Environment';
import { LevelManager } from '@/game/LevelManager';
import { PlayerController } from '@/game/PlayerController';
import { MousePicker } from '@/game/MousePicker';
import { BehaviorSystem } from '@/game/BehaviorSystem';
import { DialogSystem } from '@/game/DialogSystem';
import { GoalSystem, type ProgressCallbacks, type LevelRef } from '@/core/game/GoalSystem';
import { ObjectEditor } from '@/game/ObjectEditor';
import { Notebook } from '@/ui/Notebook';
import { Hud } from '@/ui/Hud';
import { ProgressPanel } from '@/ui/ProgressPanel';
import { SpeechBubble } from '@/ui/SpeechBubble';
import { ObjectEditorUi } from '@/ui/ObjectEditorUi';
import { SaveStore } from '@/core/data/save/SaveStore';
import { registerCustomObject, getCustomDef, getEntry } from '@/core/data/dictionary/Dictionary';
import { applyAdjectives } from '@/game/AdjectiveSystem';
import { FxParticles } from '@/fx/Particles';
import { FxFilters } from '@/fx/Filters';
import { SpawnFx } from '@/fx/SpawnFx';
import { ensureParticleTextures } from '@/fx/particleTexture';
import { log } from '@/util/log';
import type { GameEntity } from '@/game/Entity';
import type { ParseCandidate, ParsedAdjective } from '@/core/lex/InputParser';

const START_LEVEL = 'overworld-meadow';

export class WorldScene extends Phaser.Scene {
  private phys!: Physics;
  private entities!: EntityManager;
  private tagIndex!: TagIndex;
  private ruleEngine!: RuleEngine;
  private spawner!: Spawner;
  private camera!: Camera;
  private level!: LevelManager;
  private environment!: Environment;
  private player!: PlayerController;
  private picker!: MousePicker;
  private behavior!: BehaviorSystem;
  private dialog!: DialogSystem;
  private goal!: GoalSystem;
  private hud!: Hud;
  private progress!: ProgressPanel;
  private bubble!: SpeechBubble;
  private objectEditorUi!: ObjectEditorUi;
  private save!: SaveStore;
  private highlightG!: Phaser.GameObjects.Graphics | undefined;
  private ready = false;
  private fxFx!: FxFilters;
  private fxParticles!: FxParticles;
  private spawnFx!: SpawnFx;

  constructor() {
    super({ key: 'WorldScene' });
  }

  async create(): Promise<void> {
    const { width, height } = this.scale;
    void width;
    void height;

    // 装配核心系统
    this.phys = new Physics(this);
    this.entities = new EntityManager();
    this.tagIndex = new TagIndex();
    this.camera = new Camera(this.cameras.main);
    this.save = new SaveStore();
    this.environment = new Environment(this);

    // effect 依赖
    const deps: import('@/core/rules/effects').EffectDeps = {
      entities: this.entities,
      tagIndex: this.tagIndex,
      spawn: (typeId: string, x: number, y: number) => {
        const entry = getEntry(typeId);
        if (!entry) return undefined;
        const r = this.spawner.spawnEntry(entry, undefined, x, y);
        if (r.entity?.gameObject) this.phys.attachBody(r.entity.gameObject, r.entity.body);
        return r.entity as GameEntity | undefined;
      },
      destroyEntity: (e: import('@/core/entity/Entity').Entity) => {
        const ge = e as GameEntity;
        if (ge.gameObject) ge.gameObject.destroy();
        else this.phys.removeBody(ge.body);
        this.tagIndex.detach(ge, ge.tags);
        this.entities.remove(ge.id);
      },
      applyImpulse: (e: import('@/core/entity/Entity').Entity, dir: [number, number], mag: number) =>
        (e as GameEntity).applyImpulse(dir, mag),
    };

    this.ruleEngine = new RuleEngine(this.entities, this.tagIndex, () => this.time.now, deps);
    for (const r of rules) this.ruleEngine.register(r);

    this.spawner = new Spawner(
      this,
      this.entities,
      this.phys,
      this.tagIndex,
      (_scene, e) => createEntityGraphics(this, e),
      () => this.time.now,
    );

    this.level = new LevelManager(this.entities, this.spawner, this.phys);
    this.behavior = new BehaviorSystem(this.entities, () => this.time.now, deps);

    // UI 浮层
    this.hud = new Hud();
    this.progress = new ProgressPanel();
    this.bubble = new SpeechBubble();
    this.objectEditorUi = new ObjectEditorUi(new ObjectEditor(this.save));

    // 进度回调
    const cb: ProgressCallbacks = {
      onShard: (t) => this.progress.render(this.goal.stariteCount, t),
      onStarite: (t) => this.progress.render(t, this.goal.shardCount),
      onChallengeComplete: (challengeId, dialogZh) => {
        // Starite 从关卡 starite 位置或 giver NPC 头顶飞向 HUD
        const lvl = this.level.currentLevel;
        if (lvl) {
          const ch = lvl.challenges.find((c) => c.id === challengeId);
          const staritePos = lvl.starite;
          const giverNpcEid = ch ? this.level.npcEntityId(ch.giverNpcId) : undefined;
          const giverNpc = giverNpcEid ? (this.entities.get(giverNpcEid) as GameEntity | undefined) : undefined;
          const fromX = staritePos?.x ?? giverNpc?.bodyPositionX ?? 0;
          const fromY = staritePos?.y ?? (giverNpc ? giverNpc.bodyPositionY - 60 : 0);
          this.spawnFx.playStariteFly(fromX, fromY);
        }
        this.progress.toast(`完成！${dialogZh}`);
        setTimeout(() => this.progress.render(this.goal.stariteCount, this.goal.shardCount), 2400);
      },
      onWin: () => this.progress.toast('通关！Lily 解除石化'),
      onProgress: async (starites, shards, completed) => {
        await this.save.updateProgress(starites, shards, completed);
      },
    };

    this.goal = new GoalSystem(this.entities, this.level as LevelRef, cb);
    this.dialog = new DialogSystem(this.entities, this.level, this.bubble, this.camera);

    // 恢复存档：自定义物体 + 进度
    await this.restoreSave();

    // 加载首关
    this.level.load(START_LEVEL);
    this.camera.clampTo = this.level.currentLevel?.bounds;
    this.environment.build(this.level.currentLevel!);

    // 玩家（首关生成后 spawnPlayer）
    const lvl = this.level.currentLevel!;
    const player = this.spawner.spawnPlayer(lvl.playerStart.x, lvl.playerStart.y);
    if (player.gameObject) this.phys.attachBody(player.gameObject, player.body);

    // 输入
    this.player = new PlayerController(this.entities, this.phys);
    this.player.attach(this);
    this.picker = new MousePicker(this, this.entities, this.phys, this.camera);
    this.picker.attach();

    // E 键切换物体编辑器
    const kb = this.input.keyboard;
    if (kb) {
      kb.on('keydown-e', (e: KeyboardEvent) => {
        const ae = document.activeElement;
        if (ae instanceof HTMLInputElement || ae instanceof HTMLTextAreaElement) return;
        e.preventDefault();
        this.objectEditorUi.toggle();
      });
    }

    // 笔记本（DOM 元素挂在 document.body，事件闭包持有引用，无需存字段）
    new Notebook({
      onSpawn: (c, sx, sy) => this.onSpawn(c, sx, sy),
      onApplyAdjectives: (entityId, adjs) => this.onApplyAdjectives(entityId, adjs),
      selectedEntityId: () => this.picker.selectedId,
    });

    // 碰撞事件 → 规则引擎
    this.phys.onCollision((pair) => this.ruleEngine.enqueueCollision(pair));

    // 视觉增强：粒子纹理 + Camera 氛围 + 纸纹颗粒 + 火焰粒子 + 生成动效
    ensureParticleTextures(this);
    this.fxParticles = new FxParticles(this);
    this.fxFx = new FxFilters(this, this.cameras.main);
    this.fxFx.applyAmbience();
    this.fxFx.applyPaperGrain();
    this.spawnFx = new SpawnFx(this, this.fxParticles, this.camera);
    this.refreshFireParticles();

    this.ready = true;
    log.info('WorldScene.create done', { width, height, level: START_LEVEL });
  }

  /** 同步火焰粒子：为 burning 实体挂粒子，为灭火实体摘粒子 */
  private refreshFireParticles(): void {
    const burning = new Set<string>();
    for (const e of this.entities.all()) {
      const ge = e as GameEntity;
      if (ge.tags.hasState('burning') && !ge.dead) {
        burning.add(ge.id);
        this.fxParticles.attachFire(ge);
        this.fxFx.attachGlow(ge);
      }
    }
    for (const e of this.entities.all()) {
      const ge = e as GameEntity;
      if (!burning.has(ge.id)) {
        this.fxParticles.detachFire(ge);
      }
    }
  }

  /** 生成物体（笔记本回车） */
  private onSpawn(candidate: ParseCandidate, sx: number, sy: number): void {
    const w = this.camera.screenToWorld(sx, sy);
    const r = this.spawner.spawnCandidate(candidate, w.x, w.y - 40);
    if (r.reason) {
      this.progress.toast(r.reason);
      return;
    }
    if (r.entity?.gameObject) this.phys.attachBody(r.entity.gameObject, r.entity.body);
    if (r.entity) this.spawnFx.playSpawn(r.entity, sx, sy);
  }

  /** 对选中实体施加形容词 */
  private onApplyAdjectives(entityId: string, adjs: ParsedAdjective[]): void {
    const e = this.entities.get(entityId) as GameEntity | undefined;
    if (!e) return;
    const entry = getEntry(e.typeId);
    if (!entry) return;
    applyAdjectives(e, { noun: { entryId: e.typeId, text: '' }, adjectives: adjs, score: 0, raw: '' }, entry);
  }

  /** 恢复存档：自定义物体注入词典 + 进度恢复到 LevelManager/GoalSystem */
  private async restoreSave(): Promise<void> {
    const data = await this.save.load();
    for (const def of data.customObjects) {
      // 注入词典索引使分词可命中
      const full = { ...def };
      registerCustomObject(full);
      void getCustomDef(def.id);
    }
    if (data.completedChallenges.length) {
      this.level.restoreCompleted(data.completedChallenges);
    }
    this.goal.restore(data.starites, data.shards, data.completedChallenges);
    this.progress.render(data.starites, data.shards);
  }

  update(_time: number, deltaMs: number): void {
    if (!this.ready) return;
    const dt = Math.min(deltaMs, 50);
    // 1) 输入 → 玩家运动学
    this.player.update();
    // 2) 物理由 Phaser Matter 自动步进
    // 3) 规则引擎
    this.ruleEngine.update(dt);
    // 3b) 视觉增强：火焰粒子同步（燃烧态变化后刷新）
    this.fxParticles.followEntities((id) => this.entities.get(id) as GameEntity | undefined);
    this.refreshFireParticles();
    // 4) 行为系统
    this.behavior.update();
    // 5) respawn 检查（玩家掉出关卡 bounds）
    const p = this.entities.getPlayer() as GameEntity | undefined;
    if (p && this.level.currentLevel) {
      const b = this.level.currentLevel.bounds;
      if (p.bodyPositionY > b.maxY + 200) {
        p.setBodyPosition(this.player.respawnPoint.x, this.player.respawnPoint.y);
        p.setBodyVelocity(0, 0);
      }
    }
    // 6) 目标评估
    this.goal.evaluate();
    // 7) 对话更新
    this.dialog.update();
    // 8) 关卡切换检查
    if (p && this.level.currentLevel) {
      const next = this.level.checkTransition(p.bodyPositionX, p.bodyPositionY);
      if (next) {
        const keepId = p.id;
        this.level.load(next, keepId);
        this.camera.clampTo = this.level.currentLevel?.bounds;
        if (this.level.currentLevel) this.environment.build(this.level.currentLevel);
      }
    }
    // 8b) 环境层每帧更新（云漂移、门户脉动）+ 纸纹漂移
    this.environment.update(_time, dt);
    this.fxFx.update(dt);
    // 9) animTime + 渲染同步 + depth 排序
    for (const e of this.entities.all()) {
      const ge = e as GameEntity;
      ge.state.animTime += dt;
      syncGraphics(ge);
      // 隐藏玩家本体（骑乘时）
      if (ge.gameObject) {
        (ge.gameObject as unknown as { setVisible: (v: boolean) => void }).setVisible(!ge.hidden);
      }
    }
    // 选中高亮
    const sel = this.picker.selectedId;
    const selEnt = sel ? (this.entities.get(sel) as GameEntity | undefined) : undefined;
    if (selEnt) {
      this.highlightG = drawHighlight(this, selEnt, this.highlightG);
    } else if (this.highlightG) {
      this.highlightG.clear();
    }
    // 10) 相机跟随
    if (p) this.camera.followUpdate(p.bodyPositionX, p.bodyPositionY);
    // HUD
    this.hud.render(this.entities.count);
  }
}
