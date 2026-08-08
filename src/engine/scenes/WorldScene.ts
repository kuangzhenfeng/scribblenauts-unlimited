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
import { detach } from '@/engine/physics/Composite';
import { MousePicker } from '@/game/MousePicker';
import { BehaviorSystem } from '@/game/BehaviorSystem';
import { DialogSystem } from '@/game/DialogSystem';
import { QuestMarker } from '@/game/QuestMarker';
import { GoalSystem, type ProgressCallbacks, type LevelRef, type ProgressSnapshot } from '@/core/game/GoalSystem';
import { EffectResultLog } from '@/core/game/EffectResultLog';
import {
  advanceStoryProgress,
  markStoryIntroSeen,
  normalizeStoryProgress,
  STORY_WORLD_MAP_UNLOCK_STARITES,
  STORY_CURSE_BREAK_STARITES,
  STORY_FULL_COLLECTION_STARITES,
  type StoryProgress,
} from '@/core/game/StoryProgress';
import { ObjectEditor } from '@/game/ObjectEditor';
import { Notebook } from '@/ui/Notebook';
import { Hud } from '@/ui/Hud';
import { EntityHealthDisplay } from '@/ui/EntityHealthDisplay';
import { ProgressPanel } from '@/ui/ProgressPanel';
import { SpeechBubble } from '@/ui/SpeechBubble';
import { ObjectEditorUi } from '@/ui/ObjectEditorUi';
import { ObjectActionPanel } from '@/ui/ObjectActionPanel';
import { PlayerEquipmentPanel } from '@/ui/PlayerEquipmentPanel';
import { BackpackPanel } from '@/ui/BackpackPanel';
import { ObjectLibrary } from '@/game/ObjectLibrary';
import { WorldMapOverlay, type WorldMapNode } from '@/ui/WorldMapOverlay';
import { worldMapNodePosition } from '@/ui/WorldMapLayout';
import { MeritBoard, type MeritChallenge } from '@/ui/MeritBoard';
import { StariteVision, type StariteCollectible } from '@/ui/StariteVision';
import { ObjectShardBoard } from '@/ui/ObjectShardBoard';
import { FamilyBoard } from '@/ui/FamilyBoard';
import { PauseOverlay } from '@/ui/PauseOverlay';
import { TouchControls } from '@/ui/TouchControls';
import { BasicsOverlay } from '@/ui/BasicsOverlay';
import { StoryIntroOverlay } from '@/ui/StoryIntroOverlay';
import { VictoryOverlay, type VictoryOverlayVariant } from '@/ui/VictoryOverlay';
import { SaveStore } from '@/core/data/save/SaveStore';
import type { SaveData } from '@/core/types/save';
import { registerCustomObject, getCustomDef, getEntry } from '@/core/data/dictionary/Dictionary';
import { OBJECT_SHARD_CATEGORIES, OBJECT_SHARD_TASKS } from '@/core/data/starite/object-shards';
import { familyAvatarById, familyProgress, type FamilyProgressSnapshot } from '@/core/data/family/avatars';
import { L, t } from '@/core/i18n/I18n';
import { applyAdjectives } from '@/game/AdjectiveSystem';
import { FxParticles } from '@/fx/Particles';
import { FxFilters } from '@/fx/Filters';
import { SpawnFx } from '@/fx/SpawnFx';
import { ensureParticleTextures } from '@/fx/particleTexture';
import { log } from '@/util/log';
import { levelMood, music, type MusicMood } from '@/audio/MusicDirector';
import { sfx } from '@/audio/SoundEffects';
import { loadSettings } from '@/core/data/settings/SettingsStore';
import { ICON_BACKPACK, ICON_MAP, ICON_MAXWELL, ICON_PENCIL, ICON_ROTATE, ICON_SHARD, ICON_STAR, ICON_TROPHY } from '@/ui/icons';
import { UI_FONT } from '@/ui/paperStyle';
import type { GameEntity } from '@/game/Entity';
import type { LevelData } from '@/core/types/level';
import type { ParseCandidate, ParsedAdjective } from '@/core/lex/InputParser';

const START_LEVEL = 'overworld-meadow';
/** 让地面贴近视口底缘，同时为角色与对话保留稳定的上方活动空间。 */
const WORLD_CAMERA_FOCUS_OFFSET_Y = 28;

/** 关卡专属音乐优先，未指定时再按视觉主题回退。 */
function themeToMood(theme: string, bgm?: string): MusicMood {
  if (bgm) return levelMood(bgm);
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
  private effectResults!: EffectResultLog;
  private hud!: Hud;
  private entityHealthDisplay!: EntityHealthDisplay;
  private progress!: ProgressPanel;
  private bubble!: SpeechBubble;
  private objectEditorUi!: ObjectEditorUi;
  private objectActionPanel!: ObjectActionPanel;
  private playerEquipmentPanel!: PlayerEquipmentPanel;
  private objectLibrary!: ObjectLibrary;
  private objectEditor!: ObjectEditor;
  private backpackPanel!: BackpackPanel;
  private worldMapOverlay!: WorldMapOverlay;
  private meritBoard!: MeritBoard;
  private stariteVision!: StariteVision;
  private objectShardBoard!: ObjectShardBoard;
  private familyBoard!: FamilyBoard;
  private staritePickup?: Phaser.GameObjects.Sprite;
  private staritePickupTween?: Phaser.Tweens.Tween;
  private utilityButtons: HTMLButtonElement[] = [];
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
  private basicsOverlay: BasicsOverlay | undefined;
  private storyIntroOverlay: StoryIntroOverlay | undefined;
  private victoryOverlay: VictoryOverlay | undefined;
  private storyProgress!: StoryProgress;
  /** 旋转提示遮罩（landscape 模式且当前为竖屏时显示） */
  private rotateHint: HTMLDivElement | undefined;
  /** orientation.change 监听器引用，shutdown 时移除 */
  private orientationListener: (() => void) | undefined;
  /** resize 节流计时器 */
  private resizeTimer: number | undefined;
  /** 原版小键盘相机平移按键的按住态。 */
  private readonly cameraPanKeys = new Set<string>();
  /** 串行化进度写盘，避免连续召唤物体时 IndexedDB 更新互相覆盖。 */
  private progressSaveQueue: Promise<void> = Promise.resolve();

  constructor() {
    super({ key: 'WorldScene' });
  }

  async create(data: { levelId?: string } = {}): Promise<void> {
    // Phaser 4 不自动调用 scene.shutdown()，显式绑定保证装备面板和附着关系
    // 在离开世界场景时与其他 DOM 浮层一起清理。
    this.events.once('shutdown', this.shutdown, this);
    this.clearUiOverlays();
    const { width, height } = this.scale;
    void width;
    void height;

    // 装配核心系统
    this.phys = new Physics(this);
    this.entities = new EntityManager();
    this.tagIndex = new TagIndex();
    this.effectResults = new EffectResultLog();
    this.camera = new Camera(this.cameras.main);
    this.save = new SaveStore();
    this.objectLibrary = new ObjectLibrary(this.save);
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
        for (const attachment of ge.compositeAttachments ?? []) detach(this.phys, attachment);
        ge.compositeAttachments = [];
        if (ge.gameObject) ge.gameObject.destroy();
        else this.phys.removeBody(ge.body);
        this.tagIndex.detach(ge, ge.tags);
        this.entities.remove(ge.id);
      },
      applyImpulse: (e: import('@/core/entity/Entity').Entity, dir: [number, number], mag: number) =>
        (e as GameEntity).applyImpulse(dir, mag),
      storeEntity: (container, item) => {
        const target = container as GameEntity;
        const stored = item as GameEntity;
        if (target.dead || stored.dead || target === stored) return;
        if (!target.containedTypeIds) target.containedTypeIds = [];
        target.containedTypeIds.push(stored.typeId);
        stored.dead = true;
        stored.hidden = true;
        if (stored.gameObject) stored.gameObject.destroy();
        else this.phys.removeBody(stored.body);
        this.tagIndex.detach(stored, stored.tags);
        this.entities.remove(stored.id);
        log.info('object stored in container', { container: target.typeId, item: stored.typeId });
      },
      onEffectResult: (result) => this.effectResults.record(result),
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
    this.hud = new Hud(() => this.openPlayerEquipmentPanel());
    this.entityHealthDisplay = new EntityHealthDisplay();
    this.progress = new ProgressPanel();
    this.bubble = new SpeechBubble();
    this.objectEditor = new ObjectEditor(this.save);
    this.objectEditorUi = new ObjectEditorUi(this.objectEditor);

    // 进度回调
    const cb: ProgressCallbacks = {
      onShard: (t) => this.progress.render(this.goal.stariteCount, t, this.level.completedArray()),
      onStarite: (t) => {
        this.progress.render(t, this.goal.shardCount, this.level.completedArray());
        this.applyStoryProgress(t);
      },
      onObjectShard: (task, objectShards) => {
        this.objectShardBoard?.update({
          completedTaskIds: this.goal.completedObjectShardTaskIds(),
          objectShards,
        });
        this.progress.toast(L({ zh: `Object Shard：${task.zh}`, en: `Object Shard: ${task.en}` }));
        if (objectShards === 0) {
          const player = this.entities.getPlayer() as GameEntity | undefined;
          if (player) {
            this.spawnFx?.playStariteFly(player.bodyPositionX, player.bodyPositionY - 54, () => sfx.play('starite'));
          }
        } else {
          sfx.play('interact');
        }
      },
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
        this.meritBoard?.setCompleted(this.level.completedArray());
        this.syncStaritePickup();
        this.refreshStariteVisionTargets();
        const completedChallenge = this.level.currentLevel?.challenges?.find((challenge) => challenge.id === challengeId);
        if (completedChallenge?.kind === 'starite-gate') {
          const currentIndex = LevelManager.LEVEL_ORDER.indexOf(this.level.currentLevel?.id ?? '');
          const nextLevelId = currentIndex >= 0 ? LevelManager.LEVEL_ORDER[currentIndex + 1] : undefined;
          if (nextLevelId) {
            void this.save.unlockLevel(nextLevelId).then((data) => {
              this.level.setUnlockedLevels(data.unlockedLevels);
              this.worldMapOverlay?.update(this.worldMapNodes(data), data.unlockedLevels, this.level.currentLevel?.id);
            });
          }
        }
        setTimeout(() => {
          this.progress.render(this.goal.stariteCount, this.goal.shardCount, this.level.completedArray());
          this.syncStoryProgressUi(this.goal.stariteCount);
        }, 2400);
      },
      onWin: () => {
        this.applyStoryProgress(this.goal.stariteCount);
        if (!this.victoryOverlay?.isOpen) this.showVictoryOverlay();
      },
      onProgress: (snapshot) => this.persistProgress(snapshot),
    };

    this.goal = new GoalSystem(this.entities, this.level as LevelRef, cb, this.effectResults);
    this.dialog = new DialogSystem(this.entities, this.level, this.bubble, this.camera);
    this.questMarker = new QuestMarker(this, this.entities, this.level, this.dialog);

    // 恢复存档：自定义物体 + 进度
    // 恢复存档：自定义物体、Starite 进度与叙事状态
    const saveData = await this.restoreSave();
    // 难度设置 + 题目种子均来自存档（设置页统一配置），跨关 load 复用
    this.diffTier = saveData.difficultySetting.tier;
    this.diffStandard = saveData.difficultySetting.standard;
    this.questionSeed = saveData.questionSeed;

    // 加载首关（支持选关场景传入 levelId）
    const startLevelId = data.levelId ?? START_LEVEL;
    const startLevel = LevelManager.listLevels().find((level) => level.id === startLevelId);
    if (startLevel) await this.loadBackgroundAssets(startLevel);
    this.effectResults.clear();
    this.level.load(startLevelId, undefined, {
      tier: this.diffTier,
      standard: this.diffStandard,
      seedSalt: this.questionSeed,
      filterBasic: loadSettings().filterBasicQuestions,
    });
    this.camera.clampTo = this.level.currentLevel?.bounds;
    this.environment.build(this.level.currentLevel!);
    this.syncStaritePickup();
    music.start(themeToMood(this.level.currentLevel?.theme ?? 'meadow', this.level.currentLevel?.bgm));
    // 初始化顶栏挑战节点
    this.progress.setLevel(this.level.currentLevel!.challenges ?? []);
    this.setupRichUi(saveData);

    // 玩家（首关生成后 spawnPlayer）
    const lvl = this.level.currentLevel!;
    const player = this.spawner.spawnPlayer(lvl.playerStart.x, lvl.playerStart.y);
    if (player.gameObject) this.phys.attachBody(player.gameObject, player.body);
    this.applyAvatar(this.familySnapshot(saveData).selectedAvatarId);
    // 首帧直接落在玩家位置，避免相机从默认原点缓慢归位造成错误取景。
    this.camera.snapTo(player.bodyPositionX, player.bodyPositionY, WORLD_CAMERA_FOCUS_OFFSET_Y);

    // 输入
    this.player = new PlayerController(
      this.entities,
      this.phys,
      (weapon: GameEntity, x: number, y: number, facing: number) => this.spawnProjectile(weapon, x, y, facing),
      () => this.time.now,
    );
    this.player.attach(this);
    // 兜底重生点：选关进入无 keepPlayer，lastGroundedPos 初始 {0,0}，用 playerStart 兜底
    this.player.setRespawnPoint(lvl.playerStart.x, lvl.playerStart.y);
    this.picker = new MousePicker(
      this,
      this.entities,
      this.phys,
      this.camera,
      {
        onDropEntity: (entity, x, y) => this.player.tryAttachDropped(entity, x, y),
        onTapEmpty: (x, y) => this.player.setMouseMoveTarget(x, y),
        onTapEntity: (entity, x, y) => this.player.setMouseMoveTarget(x, y, entity),
        onSecondaryDown: (x, y, entity) => this.player.handleMouseSecondaryDown(x, y, entity),
        onSecondaryMove: (x, y) => this.player.handleMouseSecondaryMove(x, y),
        onSecondaryUp: () => this.player.handleMouseSecondaryUp(),
      },
    );
    this.picker.attach();

    const kb = this.input.keyboard;

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
      onOpenContainer: (entity) => this.openContainer(entity),
    });
    this.playerEquipmentPanel = new PlayerEquipmentPanel({
      getEquipment: () => this.player.getEquipmentSnapshot(),
      onUnequip: (slot) => this.player.unequip(slot),
      onUnequipWearable: (slot) => this.player.unequipWearable(slot),
      onUnequipAll: () => this.player.unequipAll(),
      onUseNotebook: () => {
        this.playerEquipmentPanel.hide();
        notebook.show('spawn');
      },
      onAddAdjective: () => {
        this.playerEquipmentPanel.hide();
        notebook.show('adjective');
      },
    });
    this.picker.onSelectionChanged = (entityId) => {
      const entity = entityId ? (this.entities.get(entityId) as GameEntity | undefined) : undefined;
      if (entity?.isPlayer) {
        this.objectActionPanel.hide();
        this.playerEquipmentPanel.show();
      } else if (entity) {
        this.playerEquipmentPanel.hide();
        this.objectActionPanel.show(entity);
      } else {
        this.playerEquipmentPanel.hide();
        this.objectActionPanel.hide();
      }
    };

    // 右上角笔记本图标按钮
    const nbBtn = document.createElement('button');
    nbBtn.type = 'button';
    nbBtn.id = 'notebook-btn';
    nbBtn.className = 'world-utility-button';
    nbBtn.title = '打开笔记本（Enter/N）';
    nbBtn.setAttribute('aria-label', '打开笔记本');
    nbBtn.setAttribute('aria-keyshortcuts', 'Enter N');
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
    this.utilityButtons.push(nbBtn);

    const utilityStyleId = 'world-utility-responsive-style';
    if (!document.getElementById(utilityStyleId)) {
      const style = document.createElement('style');
      style.id = utilityStyleId;
      style.textContent = `
        @media (max-width:600px) {
          .world-utility-button {
            top:122px !important;
            width:40px !important;
            height:40px !important;
          }
          .starite-vision__panel { top:174px !important; }
        }
      `;
      document.head.appendChild(style);
    }

    if (kb) {
      kb.on('keydown-ENTER', (e: KeyboardEvent) => {
        const ae = document.activeElement;
        if (ae instanceof HTMLInputElement || ae instanceof HTMLTextAreaElement) return;
        e.preventDefault();
        notebook.show();
      });
    }

    // 对齐原版 PC 键位：O 编辑器、N 笔记本、Q/E 旋转选中实体；小键盘控制相机。
    if (kb) {
      kb.on('keydown', (e: KeyboardEvent) => {
        if (this.isTextInputFocused()) return;
        const code = e.code;
        if (code === 'KeyO') {
          e.preventDefault();
          this.objectEditorUi.toggle();
        } else if (code === 'KeyN') {
          e.preventDefault();
          notebook.show();
        } else if (code === 'KeyQ') {
          e.preventDefault();
          this.picker.rotateSelected(-1);
        } else if (code === 'KeyE') {
          e.preventDefault();
          this.picker.rotateSelected(1);
        } else if (code === 'KeyC' || code === 'Numpad5') {
          e.preventDefault();
          const p = this.entities.getPlayer() as GameEntity | undefined;
          if (p) this.camera.resetView(p.bodyPositionX, p.bodyPositionY, WORLD_CAMERA_FOCUS_OFFSET_Y);
        } else if (code === 'Numpad8' || code === 'Numpad2' || code === 'Numpad4' || code === 'Numpad6') {
          e.preventDefault();
          this.cameraPanKeys.add(code);
        } else if (code === 'NumpadAdd' || (code === 'Equal' && e.shiftKey) || e.key === '+') {
          e.preventDefault();
          this.camera.zoomBy(0.1);
        } else if (code === 'NumpadSubtract' || code === 'Minus') {
          e.preventDefault();
          this.camera.zoomBy(-0.1);
        }
      });
      kb.on('keyup', (e: KeyboardEvent) => {
        this.cameraPanKeys.delete(e.code);
      });
    }

    // 原版 PC 鼠标滚轮缩放；DOM 输入框聚焦时不抢占滚轮。
    this.input.on(
      'wheel',
      (
        _pointer: Phaser.Input.Pointer,
        _currentlyOver: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number,
      ) => {
        if (this.isTextInputFocused()) return;
        this.camera.zoomBy(deltaY < 0 ? 0.1 : -0.1);
      },
    );

    // 暂停遮罩 + 失焦/ESC 暂停
    this.pauseOverlay = new PauseOverlay(
      () => this.resumeGame(),
      () => this.returnToMainMenu(),
    );

    // 窗口失焦：Phaser 全局 blur 事件（PlayerController 已用其清空按键集合，
    // 此处复用同一事件暂停游戏循环与音乐）
    this.sys.game.events.on('blur', () => {
      this.cameraPanKeys.clear();
      if (!this.basicsOverlay?.isOpen && !this.victoryOverlay?.isOpen) this.pauseGame();
    });

    // ESC 暂停：避开输入框聚焦与 Notebook/ConfirmDialog 的 ESC 语义
    if (kb) {
      kb.on('keydown-ESC', (e: KeyboardEvent) => {
        if (this.basicsOverlay?.isOpen || this.victoryOverlay?.isOpen) return;
        const ae = document.activeElement;
        if (ae instanceof HTMLInputElement || ae instanceof HTMLTextAreaElement) return;
        e.preventDefault();
        if (this.playerEquipmentPanel?.isOpen()) this.playerEquipmentPanel.hide();
        else if (this.paused) this.resumeGame();
        else this.pauseGame();
      });
      kb.on('keydown-I', (e: KeyboardEvent) => {
        const ae = document.activeElement;
        if (ae instanceof HTMLInputElement || ae instanceof HTMLTextAreaElement || ae instanceof HTMLSelectElement) return;
        e.preventDefault();
        if (this.playerEquipmentPanel.isOpen()) this.playerEquipmentPanel.hide();
        else this.openPlayerEquipmentPanel();
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

    this.matter.world.pause();
    music.pause();
    if (!this.storyProgress.introSeen) this.showStoryIntro(saveData.tutorialCompleted);
    else if (!saveData.tutorialCompleted) this.showBasicsOverlay();
    else this.finishFirstRunFlow();
    log.info('WorldScene.create done', { width, height, level: startLevelId });
  }

  /** 首次进入区域时只等待当前区域的两张背景板，避免与实体 atlas 按需加载相互阻塞。 */
  private async loadBackgroundAssets(level: Pick<LevelData, 'theme' | 'background'>): Promise<void> {
    const background = level.background ?? level.theme;
    const keys = [`bg-far-${background}`, `bg-near-${background}`];
    const missing = keys.filter((key) => !this.textures.exists(key));
    if (missing.length === 0) return;

    await Promise.all(missing.map((key) => new Promise<void>((resolve) => {
      const image = new Image();
      image.onload = () => {
        if (!this.textures.exists(key)) this.textures.addImage(key, image);
        resolve();
      };
      image.onerror = () => resolve();
      image.src = `assets/backgrounds/${key}.png`;
    })));
  }

  /** 首次进入世界先讲清烂苹果与 Lily 诅咒，再进入原有基础操作卡。 */
  private showStoryIntro(tutorialCompleted: boolean): void {
    this.storyIntroOverlay = new StoryIntroOverlay({
      onContinue: () => {
        this.storyProgress = markStoryIntroSeen(this.storyProgress);
        void this.save.updateStoryProgress(this.storyProgress);
        this.storyIntroOverlay?.hide();
        this.storyIntroOverlay?.destroy();
        this.storyIntroOverlay = undefined;
        if (tutorialCompleted) this.finishFirstRunFlow();
        else this.showBasicsOverlay();
      },
    });
    this.storyIntroOverlay.show();
  }

  /** 保留既有基础入门卡，只把它放到叙事卡之后。 */
  private showBasicsOverlay(): void {
    this.basicsOverlay = new BasicsOverlay(() => {
      this.basicsOverlay?.hide();
      this.basicsOverlay?.destroy();
      this.basicsOverlay = undefined;
      void this.save.markTutorialCompleted();
      this.finishFirstRunFlow();
    });
    this.basicsOverlay.show();
  }

  private finishFirstRunFlow(): void {
    this.ready = true;
    this.matter.world.resume();
    music.resume();
    this.showControlsHint();
  }

  /** 首次进入世界时给出短暂的核心操作提示，随后自动淡出，不常驻遮挡场景。 */
  private showControlsHint(): void {
    if (sessionStorage.getItem('scribblenauts-world-controls-seen')) return;
    sessionStorage.setItem('scribblenauts-world-controls-seen', '1');
    const hint = document.createElement('div');
    hint.id = 'world-controls-hint';
    if (document.body.dataset.speechBubbleActive === 'true') hint.dataset.speechActive = 'true';
    hint.textContent = '左键点地移动 · 点实体靠近使用 · 拖拽物体 · F 交互 · Q/E 旋转 · O 编辑器 · Enter/N 笔记本 · 滚轮缩放';
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
      style.textContent = '@keyframes worldControlsHint{0%{opacity:0;transform:translate(-50%,8px)}12%,72%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,-4px)}}#world-controls-hint[data-speech-active="true"]{display:none!important}@media(max-width:600px){#world-controls-hint{font-size:10px;padding:5px 9px;bottom:8px}}';
      document.head.appendChild(style);
    }
    document.body.appendChild(hint);
    window.setTimeout(() => hint.remove(), 5200);
  }

  private isTextInputFocused(): boolean {
    const active = document.activeElement;
    return active instanceof HTMLInputElement
      || active instanceof HTMLTextAreaElement
      || active instanceof HTMLSelectElement;
  }

  /** 将按住的小键盘方向转换为相机观察偏移；玩家仍保持在跟随目标。 */
  private updateCameraPan(deltaMs: number): void {
    const horizontal = (this.cameraPanKeys.has('Numpad6') ? 1 : 0)
      - (this.cameraPanKeys.has('Numpad4') ? 1 : 0);
    const vertical = (this.cameraPanKeys.has('Numpad2') ? 1 : 0)
      - (this.cameraPanKeys.has('Numpad8') ? 1 : 0);
    if (horizontal !== 0 || vertical !== 0) this.camera.panDirection(horizontal, vertical, deltaMs);
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

  /** 从 HUD 或键盘打开 Maxwell 专属装备/骑乘上下文面板。 */
  private openPlayerEquipmentPanel(): void {
    const player = this.entities?.getPlayer() as GameEntity | undefined;
    if (!player || !this.playerEquipmentPanel) return;
    this.picker.selectedId = player.id;
    this.objectActionPanel.hide();
    this.playerEquipmentPanel.show();
  }

  /** 装配原版核心辅助功能：魔法背包、世界地图、Merit Board 与 Starite Vision。 */
  private setupRichUi(saveData: Awaited<ReturnType<SaveStore['load']>>): void {
    const currentLevel = this.level.currentLevel!;
    this.backpackPanel = new BackpackPanel(this.objectLibrary, {
      onSpawn: (typeId) => void this.spawnFromLibrary(typeId),
      onEdit: (typeId) => this.objectEditorUi.openForEntity({ typeId }),
      onDuplicate: async (typeId) => {
        const result = await this.objectEditor.duplicate(typeId);
        if ('error' in result) this.progress.toast(result.error);
        await this.backpackPanel.refresh();
      },
      onDelete: async (typeId) => {
        await this.objectLibrary.removeCustomObject(typeId);
        await this.backpackPanel.refresh();
      },
    });
    this.worldMapOverlay = new WorldMapOverlay({
      nodes: this.worldMapNodes(saveData),
      unlockedLevels: saveData.unlockedLevels,
      currentLevelId: currentLevel.id,
      onEnter: (node) => this.enterLevelFromMap(node),
    });
    this.meritBoard = new MeritBoard({
      challenges: this.meritChallenges(),
      completedChallengeIds: this.level.completedArray(),
      levelTitle: currentLevel.id,
    });
    this.objectShardBoard = new ObjectShardBoard({
      categories: OBJECT_SHARD_CATEGORIES,
      tasks: OBJECT_SHARD_TASKS,
      completedTaskIds: saveData.completedObjectShardTasks,
      objectShards: saveData.objectShards,
    });
    this.familyBoard = new FamilyBoard({
      onSelect: (avatarId) => void this.selectAvatar(avatarId),
    });
    this.familyBoard.update(this.familySnapshot(saveData));
    this.stariteVision = new StariteVision({
      collectibles: this.stariteCollectibles(),
      onToggle: () => this.updateStariteVisionProjection(),
      onSelect: (target) => this.camera.snapTo(target.x, target.y, WORLD_CAMERA_FOCUS_OFFSET_Y),
    });
    const visionPanel = this.stariteVision.element.querySelector<HTMLElement>('.starite-vision__panel');
    if (visionPanel) visionPanel.style.top = '68px';

    this.addUtilityButton('backpack-btn', '打开魔法背包（B）', ICON_BACKPACK, 68, () => void this.backpackPanel.toggle());
    this.addUtilityButton('world-map-btn', '打开世界地图（M）', ICON_MAP, 122, () => this.openWorldMap());
    this.addUtilityButton('merit-board-btn', '打开挑战面板（J）', ICON_TROPHY, 176, () => this.meritBoard.show());
    this.addUtilityButton('starite-vision-btn', '打开 Starite Vision（V）', ICON_STAR, 230, () => this.stariteVision.show());
    this.addUtilityButton('object-shard-btn', '打开 Object Shard 收集（O）', ICON_SHARD, 284, () => this.toggleObjectShardBoard());
    this.addUtilityButton('family-board-btn', '打开家庭头像（K）', ICON_MAXWELL, 338, () => this.openFamilyBoard());

    const keyboard = this.input.keyboard;
    if (keyboard) {
      const shortcutAllowed = (): boolean => {
        const active = document.activeElement;
        return !(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement);
      };
      keyboard.on('keydown-B', () => { if (shortcutAllowed()) void this.backpackPanel.toggle(); });
      keyboard.on('keydown-M', () => { if (shortcutAllowed()) this.openWorldMap(); });
      keyboard.on('keydown-J', () => { if (shortcutAllowed()) this.meritBoard.show(); });
      keyboard.on('keydown-V', () => { if (shortcutAllowed()) this.stariteVision.toggleFromShortcut(); });
      keyboard.on('keydown-O', () => { if (shortcutAllowed()) this.toggleObjectShardBoard(); });
      keyboard.on('keydown-K', () => { if (shortcutAllowed()) this.openFamilyBoard(); });
    }
  }

  private toggleObjectShardBoard(): void {
    if (this.objectShardBoard.isOpen) this.objectShardBoard.hide();
    else this.objectShardBoard.show();
  }

  /** 原版在收集 3 个 Starite 后才把世界地图交给玩家。 */
  private openWorldMap(): void {
    if (!this.storyProgress.worldMapUnlocked) {
      this.progress.toast(t('story.mapLocked', { target: STORY_WORLD_MAP_UNLOCK_STARITES }));
      return;
    }
    this.worldMapOverlay.show();
  }

  private persistProgress(snapshot: ProgressSnapshot): Promise<void> {
    this.applyStoryProgress(snapshot.starites);
    this.progressSaveQueue = this.progressSaveQueue.then(async () => {
      const data = await this.save.updateProgress(
        snapshot.starites,
        snapshot.shards,
        snapshot.completed,
        snapshot.objectShards,
        snapshot.completedObjectShardTasks,
        snapshot.objectShardStarites,
        this.storyProgress,
      );
      this.meritBoard?.setCompleted(snapshot.completed);
      this.objectShardBoard?.update({
        completedTaskIds: data.completedObjectShardTasks,
        objectShards: data.objectShards,
      });
      this.familyBoard?.update(this.familySnapshot(data));
      this.worldMapOverlay?.update(this.worldMapNodes(data), data.unlockedLevels, this.level.currentLevel?.id);
    });
    return this.progressSaveQueue;
  }

  private familySnapshot(data: Pick<SaveData, 'starites' | 'completedSlots' | 'completedObjectShardTasks' | 'avatarId'>): FamilyProgressSnapshot {
    return familyProgress(
      data.starites,
      data.completedSlots,
      data.completedObjectShardTasks.length,
      data.avatarId,
    );
  }

  private openFamilyBoard(): void {
    this.familyBoard?.show();
  }

  private async selectAvatar(avatarId: string): Promise<void> {
    const data = await this.save.load();
    const snapshot = this.familySnapshot(data);
    if (!snapshot.unlockedAvatarIds.includes(avatarId)) {
      this.progress.toast(t('family.locked'));
      return;
    }
    this.applyAvatar(avatarId);
    const next = await this.save.updateAvatarId(avatarId);
    this.familyBoard?.update(this.familySnapshot(next));
  }

  /** 应用已解锁头像；human 家庭头像复用现有服装叠层，Maxwell 保留多帧动画。 */
  private applyAvatar(avatarId: string): void {
    const player = this.entities.getPlayer() as GameEntity | undefined;
    const avatar = familyAvatarById(avatarId);
    if (!player || !avatar) return;
    const currentProgress = familyProgress(
      this.goal.stariteCount,
      this.level.completedArray(),
      this.goal.completedObjectShardTaskIds().length,
      avatarId,
    );
    if (!currentProgress.unlockedAvatarIds.includes(avatar.id)) return;
    const nextDrawParams = {
      shirtColor: avatar.shirtColor,
      pantsColor: avatar.pantsColor,
      skinColor: avatar.skinColor,
    };
    if (player.rendererId === avatar.rendererId) {
      player.drawParams = nextDrawParams;
      return;
    }
    if (player.gameObject) player.gameObject.destroy();
    player.rendererId = avatar.rendererId;
    player.drawParams = nextDrawParams;
    const gameObject = createEntityGraphics(this, player);
    this.phys.attachBody(gameObject, player.body);
  }

  private addUtilityButton(
    id: string,
    title: string,
    icon: string,
    rightOffset: number,
    onClick: () => void,
  ): void {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = id;
    button.className = 'world-utility-button';
    button.title = title;
    button.setAttribute('aria-label', title);
    button.style.cssText = [
      'position:fixed',
      `top:max(14px,env(safe-area-inset-top))`,
      `right:max(${rightOffset}px,calc(env(safe-area-inset-right) + ${rightOffset - 14}px))`,
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
    button.innerHTML = icon;
    button.addEventListener('mouseenter', () => { button.style.transform = 'scale(1.08)'; });
    button.addEventListener('mouseleave', () => { button.style.transform = 'scale(1)'; });
    button.addEventListener('click', onClick);
    document.body.appendChild(button);
    this.utilityButtons.push(button);
  }

  private async spawnFromLibrary(typeId: string): Promise<void> {
    const candidate = await this.objectLibrary.getSpawnCandidate(typeId);
    if (!candidate) {
      this.progress.toast('背包条目已失效');
      return;
    }
    this.onSpawn(candidate, 0, 0);
  }

  private worldMapNodes(saveData: Awaited<ReturnType<SaveStore['load']>>): WorldMapNode[] {
    const themeNames: Record<string, string> = {
      jungle: '丛林草地',
      cave: '幽暗洞穴',
      snow: '冰雪荒原',
      desert: '烈日沙漠',
      volcano: '熔岩火山',
    };
    const { tier, standard } = saveData.difficultySetting;
    return LevelManager.listLevels().map((level, index) => {
      const slots = level.challengeSlots ?? 3;
      const gateId = `${level.id}:${tier}:${standard}:${Math.max(0, slots - 1)}`;
      const completed = slots > 0 && saveData.completedSlots.includes(gateId);
      const position = worldMapNodePosition(index, LevelManager.LEVEL_ORDER.length);
      return {
        id: level.id,
        title: themeNames[level.theme] ?? level.id,
        subtitle: `${index + 1} / ${LevelManager.LEVEL_ORDER.length}`,
        x: position.x,
        y: position.y,
        accent: index === 0 ? '#3f9a43' : '#a05a00',
        starites: completed ? 1 : 0,
        maxStarites: slots > 0 ? 1 : 0,
      };
    });
  }

  private meritChallenges(): MeritChallenge[] {
    return (this.level.currentLevel?.challenges ?? []).map((challenge) => ({
      id: challenge.id,
      title: challenge.dialog[0]?.zh ?? challenge.id,
      description: challenge.dialog[0]?.en,
      hint: challenge.dialog[1]?.zh,
      reward: challenge.reward,
    }));
  }

  private stariteCollectibles(): StariteCollectible[] {
    const level = this.level.currentLevel;
    if (!level) return [];
    const targets: StariteCollectible[] = [];
    const gate = level.challenges?.find((challenge) => challenge.kind === 'starite-gate');
    if (level.starite && (!gate || !this.level.isChallengeDone(gate.id))) {
      targets.push({
        id: `${level.id}:starite`,
        kind: 'starite',
        x: level.starite.x,
        y: level.starite.y,
        label: L({ zh: '本区域 Starite', en: 'Starite in this region' }),
      });
    }
    for (const challenge of level.challenges ?? []) {
      if (this.level.isChallengeDone(challenge.id)) continue;
      const npcEntityId = this.level.npcEntityId(challenge.giverNpcId);
      const npc = npcEntityId ? this.entities.get(npcEntityId) as GameEntity | undefined : undefined;
      const npcSpawn = level.npcs.find((spawn) => spawn.id === challenge.giverNpcId);
      const x = npc?.bodyPositionX ?? npcSpawn?.x;
      const y = npc ? npc.bodyPositionY - 54 : npcSpawn?.y;
      if (x === undefined || y === undefined) continue;
      const rewardName = challenge.reward.type === 'starite'
        ? L({ zh: 'Starite 任务', en: 'Starite task' })
        : L({ zh: '碎片任务', en: 'Shard task' });
      targets.push({
        id: `challenge:${challenge.id}`,
        kind: 'challenge',
        x,
        y,
        label: `${rewardName}：${L(challenge.dialog[0])}`,
      });
    }
    return targets;
  }

  /** 在关卡 Starite 坐标显示可领取的实体；完成对应门槛后随挑战状态摘除。 */
  private syncStaritePickup(): void {
    const level = this.level.currentLevel;
    const gate = level?.challenges?.find((challenge) => challenge.kind === 'starite-gate');
    const position = level?.starite;
    const shouldShow = Boolean(position && (!gate || !this.level.isChallengeDone(gate.id)) && this.textures.exists('starite'));
    if (!shouldShow) {
      this.staritePickupTween?.stop();
      this.staritePickupTween = undefined;
      this.staritePickup?.destroy();
      this.staritePickup = undefined;
      return;
    }
    if (!this.staritePickup) {
      this.staritePickup = this.add.sprite(position!.x, position!.y, 'starite', 'starite_0');
      this.staritePickup.setDepth(90).setScale(0.86).setScrollFactor(1, 1);
      this.staritePickup.enableFilters();
      this.staritePickup.filters?.internal.addGlow(0xffdc50, 4, 0, 1, false);
      this.staritePickupTween = this.tweens.add({
        targets: this.staritePickup,
        y: position!.y - 9,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    } else {
      this.staritePickup.setPosition(position!.x, position!.y);
    }
  }

  private refreshStariteVisionTargets(): void {
    this.stariteVision?.setCollectibles(this.stariteCollectibles());
  }

  /** 把当前未完成目标的世界坐标投影到 viewport，供 Starite Vision 绘制蓝色标记。 */
  private updateStariteVisionProjection(): void {
    if (!this.stariteVision?.isEnabled) return;
    const targets = this.stariteCollectibles();
    const cam = this.camera.cam;
    const worldPositions = Object.fromEntries(targets.map((target) => [target.id, { x: target.x, y: target.y }]));
    const projected = Object.fromEntries(targets.map((target) => {
      const screen = this.camera.worldToScreen(target.x, target.y);
      const x = screen.x;
      const y = screen.y;
      return [target.id, {
        x,
        y,
        visible: x >= cam.x - 40 && x <= cam.x + cam.width + 40 && y >= cam.y - 40 && y <= cam.y + cam.height + 40,
      }];
    }));
    this.stariteVision.setWorldPositions(worldPositions);
    this.stariteVision.setProjectedPositions(projected);
  }

  private enterLevelFromMap(node: WorldMapNode): void {
    this.worldMapOverlay.hide();
    this.scene.restart({ levelId: node.id });
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
  private onSpawn(candidate: ParseCandidate, _sx: number, _sy: number): boolean {
    const p = this.entities.getPlayer() as GameEntity | undefined;
    const spawnX = p ? p.bodyPositionX + p.state.facing * 80 : 0;
    const spawnY = p ? p.bodyPositionY - 30 : 0;
    const r = this.spawner.spawnCandidate(candidate, spawnX, spawnY);
    if (r.reason) {
      this.progress.toast(r.reason);
      return false;
    }
    if (r.entity?.gameObject) this.phys.attachBody(r.entity.gameObject, r.entity.body);
    if (r.entity) {
      const custom = getCustomDef(candidate.noun.entryId);
      this.goal.recordObjectType(custom?.baseTypeId ?? candidate.noun.entryId);
    }
    // 特效坐标从世界转屏幕
    const spawnScreen = this.camera.worldToScreen(spawnX, spawnY);
    const fxSx = spawnScreen.x;
    const fxSy = spawnScreen.y;
    if (r.entity) this.spawnFx.playSpawn(r.entity, fxSx, fxSy);
    void this.objectLibrary.recordSpawn(candidate.noun.entryId);
    return true;
  }

  /** 从已收纳的容器中逐个取出物品，重新交回世界实体系统。 */
  private openContainer(container: GameEntity): void {
    const stored = container.containedTypeIds?.splice(0) ?? [];
    stored.forEach((typeId, index) => {
      const entry = getEntry(typeId);
      if (!entry) return;
      const result = this.spawner.spawnEntry(
        entry,
        undefined,
        container.bodyPositionX + (index - (stored.length - 1) / 2) * 18,
        container.bodyPositionY - 28,
      );
      if (result.entity?.gameObject) this.phys.attachBody(result.entity.gameObject, result.entity.body);
    });
    log.info('container opened', { typeId: container.typeId, count: stored.length });
  }

  /** 生成玩家武器发射的子弹，实体装配仍统一由 Spawner 负责。 */
  private spawnProjectile(weapon: GameEntity, x: number, y: number, facing: number): void {
    const bulletEntry = getEntry('bullet');
    if (!bulletEntry) {
      log.warn('projectile spawn rejected: bullet entry missing', { weapon: weapon.id });
      sfx.play('error');
      return;
    }

    // 从枪口前方生成，避免子弹出生时与手持枪和玩家自身重叠。
    const muzzleX = x + facing * 24;
    const muzzleY = y;
    const weaponVelocity = (weapon.body as { velocity: { x: number; y: number } }).velocity;
    const result = this.spawner.spawnEntry(bulletEntry, undefined, muzzleX, muzzleY);
    if (!result.entity || result.reason) {
      log.warn('projectile spawn rejected', {
        weapon: weapon.id,
        reason: result.reason ?? 'spawn returned no entity',
      });
      return;
    }

    const projectile = result.entity;
    projectile.setBodyVelocity(weaponVelocity.x + facing * 14, weaponVelocity.y);
    projectile.state.facing = facing < 0 ? -1 : 1;
    sfx.play('shoot');
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

  /** 恢复存档：自定义物体注入词典 + 进度恢复到 LevelManager/GoalSystem/叙事状态 */
  private async restoreSave(): Promise<SaveData> {
    const data = await this.save.load();
    this.level.setUnlockedLevels(data.unlockedLevels);
    for (const def of data.customObjects) {
      // 注入词典索引使分词可命中
      const full = { ...def };
      registerCustomObject(full);
      void getCustomDef(def.id);
    }
    if (data.completedSlots.length) {
      this.level.restoreCompleted(data.completedSlots);
    }
    this.storyProgress = advanceStoryProgress(normalizeStoryProgress(data.storyProgress), data.starites);
    this.goal.restore(
      data.starites,
      data.shards,
      data.completedSlots,
      data.objectShards,
      data.completedObjectShardTasks,
      data.objectShardStarites,
    );
    this.progress.render(data.starites, data.shards, data.completedSlots);
    this.syncStoryProgressUi(data.starites);
    return data;
  }

  /** 根据 Starite 计数推进叙事，并让顶部状态与存档使用同一份状态。 */
  private applyStoryProgress(starites: number): void {
    const next = advanceStoryProgress(this.storyProgress, starites);
    if (
      next.lilyCondition !== this.storyProgress.lilyCondition
      || next.edgarRevealed !== this.storyProgress.edgarRevealed
      || next.worldMapUnlocked !== this.storyProgress.worldMapUnlocked
      || next.fullCollectionComplete !== this.storyProgress.fullCollectionComplete
    ) {
      if (!this.storyProgress.fullCollectionComplete && next.fullCollectionComplete) {
        this.progress.toast(t('story.fullCollection', { target: STORY_FULL_COLLECTION_STARITES }));
        this.showVictoryOverlay('collection');
      }
      this.storyProgress = next;
    }
    this.syncStoryProgressUi(starites);
  }

  private syncStoryProgressUi(starites: number): void {
    this.progress.setStoryStatus({
      starites,
      target: STORY_CURSE_BREAK_STARITES,
      lilyCondition: this.storyProgress.lilyCondition,
    });
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

  /** 从暂停菜单返回标题页，避免把暂停态带入下一次世界场景。 */
  private returnToMainMenu(): void {
    if (!this.paused) return;
    this.paused = false;
    this.pauseOverlay.hide();
    music.start('title');
    this.scene.start('TitleScene');
    // Phaser 4 在 DOM 事件回调中不会自动处理场景切换队列。
    this.scene.manager.processQueue();
    log.info('returned to main menu');
  }

  /** Starite 门槛达成后暂停世界，给玩家明确的解咒结果与下一步出口。 */
  private showVictoryOverlay(variant: VictoryOverlayVariant = 'curse'): void {
    if (!this.victoryOverlay) {
      this.victoryOverlay = new VictoryOverlay({
        onContinue: () => this.dismissVictoryOverlay(),
        onMap: () => {
          this.dismissVictoryOverlay();
          this.worldMapOverlay.show();
        },
      });
    }
    this.matter.world.pause();
    music.pause();
    this.victoryOverlay.show(variant);
    log.info('victory overlay shown');
  }

  /** 胜利卡两个出口共用同一恢复路径，避免继续探索与地图入口状态分叉。 */
  private dismissVictoryOverlay(): void {
    if (!this.victoryOverlay?.isOpen) return;
    this.victoryOverlay.hide();
    this.matter.world.resume();
    music.resume();
    log.info('victory overlay dismissed');
  }

  update(_time: number, deltaMs: number): void {
    if (!this.ready) return;
    if (this.paused || this.victoryOverlay?.isOpen) return;
    const dt = Math.min(deltaMs, 50);
    // 1) 输入 → 玩家运动学
    this.player.update(this.time.now);
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
        this.player.respawn();
      } else if (p.dead) {
        const timers = p.stateTimers ?? (p.stateTimers = new Map<string, number>());
        const respawnAt = timers.get('player-respawn-at');
        if (respawnAt === undefined) timers.set('player-respawn-at', this.time.now + 900);
        else if (this.time.now >= respawnAt) {
          timers.delete('player-respawn-at');
          this.player.respawn();
        }
      } else {
        p.stateTimers?.delete('player-respawn-at');
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
        // 旧关卡实体会被 LevelManager 清场，先解除枪械/翅膀/坐骑约束，
        // 避免 PlayerController 在下一关继续驱动已移除的 Matter body。
        this.player.detachAllAttachments();
        this.effectResults.clear();
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
          filterBasic: loadSettings().filterBasicQuestions,
        });
        this.camera.clampTo = this.level.currentLevel?.bounds;
        if (this.level.currentLevel) this.environment.build(this.level.currentLevel);
        music.setMood(themeToMood(this.level.currentLevel?.theme ?? 'meadow', this.level.currentLevel?.bgm));
        // 切关后重生点兜底为新关卡 playerStart
        if (this.level.currentLevel) {
          this.player.setRespawnPoint(this.level.currentLevel.playerStart.x, this.level.currentLevel.playerStart.y);
        }
        // 切关后刷新顶栏挑战节点为新关卡题目
        this.progress.setLevel(this.level.currentLevel?.challenges ?? []);
        this.meritBoard.update(this.meritChallenges(), this.level.completedArray());
        this.meritBoard.setLevelTitle(this.level.currentLevel?.id);
        this.syncStaritePickup();
        this.refreshStariteVisionTargets();
        void this.save.load().then((data) => {
          this.level.setUnlockedLevels(data.unlockedLevels);
          this.worldMapOverlay.update(this.worldMapNodes(data), data.unlockedLevels, this.level.currentLevel?.id);
        });
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
      if (selEnt.isPlayer) {
        this.objectActionPanel.hide();
        if (selEnt.dead) this.playerEquipmentPanel.hide();
        else this.playerEquipmentPanel.refresh();
      } else if (selEnt.dead) {
        this.objectActionPanel.hide();
        this.playerEquipmentPanel.hide();
      }
    } else if (this.highlightG) {
      this.highlightG.clear();
      this.playerEquipmentPanel.hide();
      this.objectActionPanel.hide();
    }
    // 10) 相机跟随（叠加原版小键盘手动观察偏移）
    this.updateCameraPan(dt);
    if (p) this.camera.followUpdate(p.bodyPositionX, p.bodyPositionY, WORLD_CAMERA_FOCUS_OFFSET_Y);
    this.updateStariteVisionProjection();
    // HUD
    this.hud.render(
      this.entities.count,
      this.goal.stariteCount,
      this.goal.shardCount,
    );
    const selectedEntity = this.picker.selectedId
      ? this.entities.get(this.picker.selectedId)
      : undefined;
    this.entityHealthDisplay.render(selectedEntity, this.camera);
  }

  /** 场景关闭时清理 DOM 浮层与监听器，避免切场景后残留 */
  shutdown(): void {
    this.basicsOverlay?.destroy();
    this.basicsOverlay = undefined;
    this.storyIntroOverlay?.destroy();
    this.storyIntroOverlay = undefined;
    this.victoryOverlay?.destroy();
    this.victoryOverlay = undefined;
    this.entityHealthDisplay?.destroy();
    this.picker?.destroy();
    this.player?.detachAllAttachments();
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
    this.backpackPanel?.hide();
    this.worldMapOverlay?.destroy();
    this.meritBoard?.destroy();
    this.stariteVision?.destroy();
    this.storyIntroOverlay?.destroy();
    this.storyIntroOverlay = undefined;
    this.objectShardBoard?.destroy();
    this.familyBoard?.destroy();
    this.staritePickupTween?.stop();
    this.staritePickup?.destroy();
    this.staritePickupTween = undefined;
    this.staritePickup = undefined;
    this.victoryOverlay?.destroy();
    this.victoryOverlay = undefined;
    for (const button of this.utilityButtons) button.remove();
    this.utilityButtons = [];
    document.getElementById('title-overlay')?.remove();
    for (const id of [
      'hud',
      'entity-health-display',
      'progress',
      'speech-bubble',
      'notebook',
      'autocomplete',
      'candidate-menu',
      'object-action-panel',
      'player-equipment-panel',
      'object-editor',
      'family-board',
      'pause-overlay',
      'basics-overlay',
      'story-intro-overlay',
      'victory-overlay',
      'touch-controls',
      'notebook-btn',
      'backpack-panel',
      'world-map-overlay',
      'merit-board',
      'starite-vision',
      'world-utility-responsive-style',
      'object-shard-board',
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
