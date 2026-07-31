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
import type { DifficultyTier, DifficultyStandard } from '@/core/types/question';
import { PlayerController } from '@/game/PlayerController';
import { MousePicker } from '@/game/MousePicker';
import { BehaviorSystem } from '@/game/BehaviorSystem';
import { DialogSystem } from '@/game/DialogSystem';
import { QuestMarker } from '@/game/QuestMarker';
import { GoalSystem, type ProgressCallbacks, type LevelRef } from '@/core/game/GoalSystem';
import { ObjectEditor } from '@/game/ObjectEditor';
import { Notebook } from '@/ui/Notebook';
import { Hud } from '@/ui/Hud';
import { ProgressPanel } from '@/ui/ProgressPanel';
import { SpeechBubble } from '@/ui/SpeechBubble';
import { ObjectEditorUi } from '@/ui/ObjectEditorUi';
import { ObjectActionPanel } from '@/ui/ObjectActionPanel';
import { PauseOverlay } from '@/ui/PauseOverlay';
import { TouchControls } from '@/ui/TouchControls';
import { SaveStore } from '@/core/data/save/SaveStore';
import { registerCustomObject, getCustomDef, getEntry } from '@/core/data/dictionary/Dictionary';
import { applyAdjectives } from '@/game/AdjectiveSystem';
import { FxParticles } from '@/fx/Particles';
import { FxFilters } from '@/fx/Filters';
import { SpawnFx } from '@/fx/SpawnFx';
import { ensureParticleTextures } from '@/fx/particleTexture';
import { log } from '@/util/log';
import { music, type MusicMood } from '@/audio/MusicDirector';
import { sfx } from '@/audio/SoundEffects';
import { loadSettings } from '@/core/data/settings/SettingsStore';
import { ICON_PENCIL, ICON_ROTATE } from '@/ui/icons';
import { UI_FONT } from '@/ui/paperStyle';
import type { GameEntity } from '@/game/Entity';
import type { ParseCandidate, ParsedAdjective } from '@/core/lex/InputParser';

const START_LEVEL = 'overworld-meadow';
/** 让地面贴近视口底缘，同时为角色与对话保留稳定的上方活动空间。 */
const WORLD_CAMERA_FOCUS_OFFSET_Y = 28;

/** 关卡主题 → 音乐情绪映射（替换旧硬编码 cave/meadow 二分） */
function themeToMood(theme: string): MusicMood {
  switch (theme) {
    case 'cave': return 'cave';
    case 'snow': return 'snow';
    case 'desert': return 'desert';
    case 'volcano': return 'volcano';
    case 'jungle': return 'jungle';
    default: return 'meadow';
  }
}

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
  private questMarker!: QuestMarker;
  private goal!: GoalSystem;
  private hud!: Hud;
  private progress!: ProgressPanel;
  private bubble!: SpeechBubble;
  private objectEditorUi!: ObjectEditorUi;
  private objectActionPanel!: ObjectActionPanel;
  private pauseOverlay!: PauseOverlay;
  /** 游戏是否处于暂停态（窗口失焦或 ESC 触发） */
  private paused = false;
  private save!: SaveStore;
  /** 当前会话的难度设置（create 时从场景数据捕获，跨关 load 复用） */
  private diffTier: DifficultyTier = 1;
  private diffStandard: DifficultyStandard = 'cefr';
  /** 题目随机种子（从存档读取，跨关 load 复用；换种子 = 换一轮题目） */
  private questionSeed = '';
  private highlightG!: Phaser.GameObjects.Graphics | undefined;
  private ready = false;
  private fxFx!: FxFilters;
  private fxParticles!: FxParticles;
  private spawnFx!: SpawnFx;
  private touchControls!: TouchControls;
  /** 旋转提示遮罩（landscape 模式且当前为竖屏时显示） */
  private rotateHint: HTMLDivElement | undefined;
  /** orientation.change 监听器引用，shutdown 时移除 */
  private orientationListener: (() => void) | undefined;
  /** resize 节流计时器 */
  private resizeTimer: number | undefined;

  constructor() {
    super({ key: 'WorldScene' });
  }

  async create(data: { levelId?: string } = {}): Promise<void> {
    this.clearUiOverlays();
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
    // BehaviorSystem 延迟读取 dialog.dialogActiveEntityId：构造期 this.dialog 尚未赋值，
    // getter 在 update 时才求值，届时 DialogSystem 已创建
    this.behavior = new BehaviorSystem(this.entities, () => this.time.now, deps, () => this.dialog.dialogActiveEntityId);

    // UI 浮层
    this.hud = new Hud();
    this.progress = new ProgressPanel();
    this.bubble = new SpeechBubble();
    this.objectEditorUi = new ObjectEditorUi(new ObjectEditor(this.save));

    // 进度回调
    const cb: ProgressCallbacks = {
      onShard: (t) => this.progress.render(this.goal.stariteCount, t, this.level.completedArray()),
      onStarite: (t) => this.progress.render(t, this.goal.shardCount, this.level.completedArray()),
      onChallengeComplete: (challengeId, dialogZh) => {
        // Starite 从关卡 starite 位置或 giver NPC 头顶飞向 HUD
        const lvl = this.level.currentLevel;
        if (lvl?.challenges) {
          const ch = lvl.challenges.find((c) => c.id === challengeId);
          const staritePos = lvl.starite;
          const giverNpcEid = ch ? this.level.npcEntityId(ch.giverNpcId) : undefined;
          const giverNpc = giverNpcEid ? (this.entities.get(giverNpcEid) as GameEntity | undefined) : undefined;
          const fromX = staritePos?.x ?? giverNpc?.bodyPositionX ?? 0;
          const fromY = staritePos?.y ?? (giverNpc ? giverNpc.bodyPositionY - 60 : 0);
          sfx.play('questComplete');
          this.spawnFx.playStariteFly(fromX, fromY, () => sfx.play('starite'));
        }
        this.progress.toast(`完成！${dialogZh}`);
        setTimeout(() => this.progress.render(this.goal.stariteCount, this.goal.shardCount, this.level.completedArray()), 2400);
      },
      onWin: () => this.progress.toast('通关！Lily 解除石化'),
      onProgress: async (starites, shards, completed) => {
        await this.save.updateProgress(starites, shards, completed);
      },
    };

    this.goal = new GoalSystem(this.entities, this.level as LevelRef, cb);
    this.dialog = new DialogSystem(this.entities, this.level, this.bubble, this.camera);
    this.questMarker = new QuestMarker(this, this.entities, this.level, this.dialog);

    // 恢复存档：自定义物体 + 进度
    await this.restoreSave();
    // 难度设置 + 题目种子均来自存档（设置页统一配置），跨关 load 复用
    const saveData = await this.save.load();
    this.diffTier = saveData.difficultySetting.tier;
    this.diffStandard = saveData.difficultySetting.standard;
    this.questionSeed = saveData.questionSeed;

    // 加载首关（支持选关场景传入 levelId）
    const startLevelId = data.levelId ?? START_LEVEL;
    this.level.load(startLevelId, undefined, {
      tier: this.diffTier,
      standard: this.diffStandard,
      seedSalt: this.questionSeed,
    });
    this.camera.clampTo = this.level.currentLevel?.bounds;
    this.environment.build(this.level.currentLevel!);
    music.start(themeToMood(this.level.currentLevel?.theme ?? 'meadow'));
    // 初始化顶栏挑战节点
    this.progress.setLevel(this.level.currentLevel!.challenges ?? []);

    // 玩家（首关生成后 spawnPlayer）
    const lvl = this.level.currentLevel!;
    const player = this.spawner.spawnPlayer(lvl.playerStart.x, lvl.playerStart.y);
    if (player.gameObject) this.phys.attachBody(player.gameObject, player.body);
    // 首帧直接落在玩家位置，避免相机从默认原点缓慢归位造成错误取景。
    this.camera.snapTo(player.bodyPositionX, player.bodyPositionY, WORLD_CAMERA_FOCUS_OFFSET_Y);

    // 输入
    this.player = new PlayerController(this.entities, this.phys);
    this.player.attach(this);
    // 兜底重生点：选关进入无 keepPlayer，lastGroundedPos 初始 {0,0}，用 playerStart 兜底
    this.player.setRespawnPoint(lvl.playerStart.x, lvl.playerStart.y);
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

    // 笔记本（默认隐藏；Enter 键 / 右上角按钮切换，ESC 关闭）
    const notebook = new Notebook({
      onSpawn: (c, sx, sy) => this.onSpawn(c, sx, sy),
      onApplyAdjectives: (entityId, adjs) => this.onApplyAdjectives(entityId, adjs),
      selectedEntityId: () => this.picker.selectedId,
    });
    this.objectActionPanel = new ObjectActionPanel({
      onUseNotebook: () => notebook.show('spawn'),
      onCreateObject: () => notebook.show('spawn'),
      onAddAdjective: () => notebook.show('adjective'),
      onEditObject: (entity) => this.objectEditorUi.openForEntity(entity),
    });
    this.picker.onSelectionChanged = (entityId) => {
      const entity = entityId ? (this.entities.get(entityId) as GameEntity | undefined) : undefined;
      if (entity) this.objectActionPanel.show(entity);
      else this.objectActionPanel.hide();
    };

    // 右上角笔记本图标按钮
    const nbBtn = document.createElement('button');
    nbBtn.type = 'button';
    nbBtn.id = 'notebook-btn';
    nbBtn.title = '打开笔记本（Enter）';
    nbBtn.setAttribute('aria-label', '打开笔记本');
    nbBtn.setAttribute('aria-keyshortcuts', 'Enter');
    nbBtn.style.cssText = [
      'position:fixed',
      `top:max(14px,env(safe-area-inset-top))`,
      `right:max(14px,env(safe-area-inset-right))`,
      'z-index:51',
      'width:46px',
      'height:46px',
      'background:#f4c54f',
      'border:2px solid #6a3d08',
      'border-radius:10px',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'cursor:pointer',
      'box-shadow:0 2px 0 #6a3d08,0 4px 10px rgba(48,34,18,0.2),inset 0 1px 0 rgba(255,255,255,0.48)',
      'transition:transform 0.12s ease,box-shadow 0.12s ease',
      'user-select:none',
    ].join(';');
    nbBtn.innerHTML = ICON_PENCIL;
    nbBtn.addEventListener('mouseenter', () => {
      nbBtn.style.transform = 'scale(1.1)';
      nbBtn.style.boxShadow = '0 6px 20px rgba(0,0,0,0.65),inset 0 1px 0 rgba(255,240,160,0.5)';
    });
    nbBtn.addEventListener('mouseleave', () => {
      nbBtn.style.transform = 'scale(1.0)';
      nbBtn.style.boxShadow = '0 4px 14px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,240,160,0.5)';
    });
    nbBtn.addEventListener('click', () => notebook.toggle());
    document.body.appendChild(nbBtn);

    if (kb) {
      kb.on('keydown-ENTER', (e: KeyboardEvent) => {
        const ae = document.activeElement;
        if (ae instanceof HTMLInputElement || ae instanceof HTMLTextAreaElement) return;
        e.preventDefault();
        notebook.show();
      });
    }

    // 暂停遮罩 + 失焦/ESC 暂停
    this.pauseOverlay = new PauseOverlay(() => this.resumeGame());

    // 窗口失焦：Phaser 全局 blur 事件（PlayerController 已用其清空按键集合，
    // 此处复用同一事件暂停游戏循环与音乐）
    this.sys.game.events.on('blur', () => this.pauseGame());

    // ESC 暂停：避开输入框聚焦与 Notebook/ConfirmDialog 的 ESC 语义
    if (kb) {
      kb.on('keydown-ESC', (e: KeyboardEvent) => {
        const ae = document.activeElement;
        if (ae instanceof HTMLInputElement || ae instanceof HTMLTextAreaElement) return;
        e.preventDefault();
        if (this.paused) this.resumeGame();
        else this.pauseGame();
      });
    }

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

    // 触屏虚拟控制：按设置显隐，触屏设备开箱可玩
    this.touchControls = new TouchControls(this.player);
    if (TouchControls.shouldShow()) this.touchControls.show();
    else this.touchControls.hide();

    // 订阅 Phaser ScaleManager 的 RESIZE 事件，重建固定屏背景层 + 通知触屏控制重定位
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      // 节流：高频拖窗/旋转时合并到 16ms 后执行，避免背景层反复重建卡顿
      if (this.resizeTimer !== undefined) window.clearTimeout(this.resizeTimer);
      this.resizeTimer = window.setTimeout(() => {
        this.resize(gameSize.width, gameSize.height);
        this.resizeTimer = undefined;
      }, 80);
    });

    // landscape 偏好：竖屏时显示旋转提示遮罩（best-effort，iOS 非 PWA 无法 lock 的兜底）
    const orientationPref = loadSettings().orientation;
    if (orientationPref === 'landscape') this._setupRotateHint();

    this.ready = true;
    this.showControlsHint();
    log.info('WorldScene.create done', { width, height, level: startLevelId });
  }

  /** 首次进入世界时给出短暂的核心操作提示，随后自动淡出，不常驻遮挡场景。 */
  private showControlsHint(): void {
    if (sessionStorage.getItem('scribblenauts-world-controls-seen')) return;
    sessionStorage.setItem('scribblenauts-world-controls-seen', '1');
    const hint = document.createElement('div');
    hint.id = 'world-controls-hint';
    if (document.body.dataset.speechBubbleActive === 'true') hint.dataset.speechActive = 'true';
    hint.textContent = 'WASD 移动  ·  空格 跳跃  ·  F 拾取  ·  Enter 笔记本';
    hint.style.cssText = [
      'position:fixed',
      'left:50%',
      'bottom:max(14px,env(safe-area-inset-bottom))',
      'transform:translateX(-50%)',
      'z-index:44',
      'pointer-events:none',
      'padding:6px 12px',
      'border:1px solid rgba(255,248,220,0.44)',
      'border-radius:999px',
      'background:rgba(18,25,31,0.72)',
      'color:#fff8dd',
      `font-family:${UI_FONT}`,
      'font-size:12px',
      'font-weight:800',
      'letter-spacing:0.02em',
      'white-space:nowrap',
      'box-shadow:0 3px 12px rgba(0,0,0,0.22)',
      'animation:worldControlsHint 5s ease both',
    ].join(';');
    if (!document.getElementById('world-controls-hint-style')) {
      const style = document.createElement('style');
      style.id = 'world-controls-hint-style';
      style.textContent = '@keyframes worldControlsHint{0%{opacity:0;transform:translate(-50%,8px)}12%,72%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,-4px)}}@media(max-width:600px){#world-controls-hint{font-size:10px;padding:5px 9px;bottom:8px}#world-controls-hint[data-speech-active="true"]{display:none!important}}';
      document.head.appendChild(style);
    }
    document.body.appendChild(hint);
    window.setTimeout(() => hint.remove(), 5200);
  }

  /**
   * 窗口尺寸变化重布局：重建固定屏背景层 + 触屏控制重定位。
   * 由 ScaleManager RESIZE 事件触发（节流后调用），地面/平台/装饰等世界坐标层不动。
   */
  resize(width: number, height: number): void {
    if (!this.ready) return;
    this.environment.resize(width, height);
    this.touchControls?.onResize();
    log.info('WorldScene resize', { width, height });
  }

  /**
   * landscape 偏好下，监听方向变化：竖屏时显示旋转提示，横屏时移除。
   * iOS Safari 非 PWA 不支持 screen.orientation.lock，此遮罩为兜底提示。
   */
  private _setupRotateHint(): void {
    const mq = window.matchMedia('(orientation: portrait)');
    const update = () => this._updateRotateHint(mq.matches);
    update();
    // addEventListener 兼容 Safari < 14 的 addListener
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', update);
      this.orientationListener = () => mq.removeEventListener('change', update);
    }
  }

  private _updateRotateHint(portrait: boolean): void {
    if (portrait && !this.rotateHint) {
      const el = document.createElement('div');
      el.id = 'rotate-hint';
      el.style.cssText = [
        'position:fixed',
        'inset:0',
        'z-index:200',
        'display:flex',
        'flex-direction:column',
        'align-items:center',
        'justify-content:center',
        'gap:18px',
        'background:rgba(10,18,8,0.86)',
        'pointer-events:none',
        'color:#fff8dd',
        `font-family:${UI_FONT}`,
        'font-size:22px',
        'font-weight:900',
        'letter-spacing:0.1em',
        'text-align:center',
        'padding:32px',
      ].join(';');
      const icon = document.createElement('div');
      icon.innerHTML = ICON_ROTATE;
      icon.style.cssText = 'animation:rotateHint 1.8s ease-in-out infinite';
      const tip = document.createElement('div');
      tip.textContent = '旋转设备至横屏以获得最佳体验';
      el.appendChild(icon);
      el.appendChild(tip);
      // 注入旋转动画（命名空间隔离）
      if (!document.getElementById('rotate-hint-anim')) {
        const style = document.createElement('style');
        style.id = 'rotate-hint-anim';
        style.textContent = '@keyframes rotateHint{0%,100%{transform:rotate(0deg)}50%{transform:rotate(90deg)}}';
        document.head.appendChild(style);
      }
      document.body.appendChild(el);
      this.rotateHint = el;
    } else if (!portrait && this.rotateHint) {
      this.rotateHint.remove();
      this.rotateHint = undefined;
    }
  }

  /** 同步火焰粒子：为 burning 实体挂粒子，为灭火实体摘粒子 */
  private refreshFireParticles(): void {
    const burning = new Set<string>();
    for (const e of this.entities.all()) {
      const ge = e as GameEntity;
      if (ge.tags.hasState('burning') && !ge.dead && ge.typeId !== 'lava') {
        burning.add(ge.id);
        this.fxParticles.attachFire(ge);
        this.fxFx.attachGlow(ge);
      }
    }
    for (const e of this.entities.all()) {
      const ge = e as GameEntity;
      if (!burning.has(ge.id)) {
        this.fxParticles.detachFire(ge);
        this.fxFx.detachGlow(ge);
      }
    }
  }

  /** 生成物体（笔记本回车）：出现在主角前方约 80px 处 */
  private onSpawn(candidate: ParseCandidate, _sx: number, _sy: number): void {
    const p = this.entities.getPlayer() as GameEntity | undefined;
    const spawnX = p ? p.bodyPositionX + p.state.facing * 80 : 0;
    const spawnY = p ? p.bodyPositionY - 30 : 0;
    const r = this.spawner.spawnCandidate(candidate, spawnX, spawnY);
    if (r.reason) {
      this.progress.toast(r.reason);
      return;
    }
    if (r.entity?.gameObject) this.phys.attachBody(r.entity.gameObject, r.entity.body);
    // 特效坐标从世界转屏幕
    const cam = this.camera.cam;
    const fxSx = (spawnX - cam.scrollX) * cam.zoom + cam.x;
    const fxSy = (spawnY - cam.scrollY) * cam.zoom + cam.y;
    if (r.entity) this.spawnFx.playSpawn(r.entity, fxSx, fxSy);
  }

  /** 对选中实体施加形容词 */
  private onApplyAdjectives(entityId: string, adjs: ParsedAdjective[]): void {
    const e = this.entities.get(entityId) as GameEntity | undefined;
    if (!e) return;
    const entry = getEntry(e.typeId);
    if (!entry) return;
    applyAdjectives(e, { noun: { entryId: e.typeId, text: '' }, adjectives: adjs, score: 0, raw: '' }, entry);
    // 合并记录被施加的形容词 id，供 GoalSystem 校验"红色鸟"等形容词题目
    if (!e.appliedAdjectives) e.appliedAdjectives = new Set<string>();
    for (const a of adjs) e.appliedAdjectives.add(a.adjId);
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
    if (data.completedSlots.length) {
      this.level.restoreCompleted(data.completedSlots);
    }
    this.goal.restore(data.starites, data.shards, data.completedSlots);
    this.progress.render(data.starites, data.shards, data.completedSlots);
  }

  /**
   * 暂停游戏：物理世界、规则引擎、行为系统、音乐全部停转。
   * 触发时机：窗口失焦（Phaser blur 事件）/ 按 ESC。
   * 幂等：已暂停时再调不会重复暂停。
   */
  pauseGame(): void {
    if (this.paused) return;
    this.paused = true;
    // Matter World.pause 置 enabled=false，Scene UPDATE 事件驱动的 world.update 会提前返回
    this.matter.world.pause();
    music.pause();
    this.pauseOverlay.show();
    log.info('game paused');
  }

  /**
   * 恢复游戏：物理世界重置步进计时、音乐淡入、遮罩关闭。
   * 幂等：未暂停时调用为 no-op。
   */
  resumeGame(): void {
    if (!this.paused) return;
    this.paused = false;
    this.matter.world.resume();
    music.resume();
    this.pauseOverlay.hide();
    log.info('game resumed');
  }

  update(_time: number, deltaMs: number): void {
    if (!this.ready) return;
    if (this.paused) return;
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
    this.questMarker.update(_time);
    // 8) 关卡切换检查
    if (p && this.level.currentLevel) {
      const next = this.level.checkTransition(p.bodyPositionX, p.bodyPositionY);
      if (next) {
        const keepId = p.id;
        // 先销毁旧实体的 GameObjects，避免精灵图残留场景
        for (const e of this.entities.all()) {
          if (e.id === keepId) continue;
          const ge = e as GameEntity;
          if (ge.gameObject) ge.gameObject.destroy();
        }
        this.level.load(next, keepId, {
          tier: this.diffTier,
          standard: this.diffStandard,
          seedSalt: this.questionSeed,
        });
        this.camera.clampTo = this.level.currentLevel?.bounds;
        if (this.level.currentLevel) this.environment.build(this.level.currentLevel);
        music.setMood(themeToMood(this.level.currentLevel?.theme ?? 'meadow'));
        // 切关后重生点兜底为新关卡 playerStart
        if (this.level.currentLevel) {
          this.player.setRespawnPoint(this.level.currentLevel.playerStart.x, this.level.currentLevel.playerStart.y);
        }
        // 切关后刷新顶栏挑战节点为新关卡题目
        this.progress.setLevel(this.level.currentLevel?.challenges ?? []);
        // 立即 snap 相机到玩家新位置，避免 lerp 造成玩家飞出画面
        this.camera.snapTo(p.bodyPositionX, p.bodyPositionY, WORLD_CAMERA_FOCUS_OFFSET_Y);
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
      if (selEnt.dead) this.objectActionPanel.hide();
    } else if (this.highlightG) {
      this.highlightG.clear();
      this.objectActionPanel.hide();
    }
    // 10) 相机跟随
    if (p) this.camera.followUpdate(p.bodyPositionX, p.bodyPositionY, WORLD_CAMERA_FOCUS_OFFSET_Y);
    // HUD
    this.hud.render(this.entities.count, this.goal.stariteCount, this.goal.shardCount);
  }

  /** 场景关闭时清理 DOM 浮层与监听器，避免切场景后残留 */
  shutdown(): void {
    this.pauseOverlay?.hide();
    this.touchControls?.hide();
    if (this.resizeTimer !== undefined) window.clearTimeout(this.resizeTimer);
    if (this.orientationListener) {
      this.orientationListener();
      this.orientationListener = undefined;
    }
    this.rotateHint?.remove();
    this.rotateHint = undefined;

    // WorldScene 的 DOM 浮层不属于 Phaser display list，切换/重启场景时必须显式清理。
    // 否则逐关复核或从选关重新进入时会叠出多个 HUD、进度条和对话气泡，造成画面杂乱。
    this.clearUiOverlays();
  }

  /** 清理本场景创建的 DOM 浮层，兼容场景重启与切换两种生命周期路径。 */
  private clearUiOverlays(): void {
    document.getElementById('title-overlay')?.remove();
    for (const id of [
      'hud',
      'progress',
      'speech-bubble',
      'notebook',
      'autocomplete',
      'candidate-menu',
      'object-action-panel',
      'object-editor',
      'pause-overlay',
      'touch-controls',
      'notebook-btn',
      'progress-layout-style',
      'speech-bubble-layout-style',
      'world-controls-hint',
      'world-controls-hint-style',
    ]) {
      document.getElementById(id)?.remove();
    }
    delete document.body.dataset.speechBubbleActive;
  }
}
