/**
 * 简易问答场景 —— 面向手机竖屏的问答玩法。
 *
 * 上屏：复用 Environment 视差背景 + quiz-arena 关卡（树/石/草丛装饰），
 * 中央生成提问生物 sprite，气泡展示题面。相机视口裁剪为键盘以上区域，
 * 游戏画面只占上屏，不被键盘遮挡。
 * 下屏：定制化键盘（QuizKeyboard）输入答案，点候选生成物品并判定。
 *
 * 与 WorldScene 的差异：无玩家/NPC 对话/规则引擎/行为系统/MousePicker/
 * TouchControls，只保留物理/生成/渲染/环境/动效的最小子集 + 问答循环。
 * 答案判定用 QuizJudge（闭集匹配纯函数），回合管理用 QuizRoundPicker。
 *
 * 布局：竖屏上下分屏（上屏游戏 + 下屏键盘），横屏/桌面自适应键盘限宽居中。
 * 暂停：ESC 返回标题页（简易模式无复杂暂停态，直接退出）。
 */

import Phaser from 'phaser';
import { Physics } from '@/engine/physics/Physics';
import { EntityManager } from '@/game/EntityManager';
import { TagIndex } from '@/core/rules/TagIndex';
import { Spawner } from '@/game/Spawner';
import { Camera } from '@/engine/render/Camera';
import { createEntityGraphics, syncGraphics } from '@/engine/render/EntityGraphics';
import { Environment } from '@/engine/render/Environment';
import { QuizKeyboard } from '@/ui/QuizKeyboard';
import { QuizHud } from '@/ui/QuizHud';
import { SpeechBubble } from '@/ui/SpeechBubble';
import { QuizRoundPicker } from '@/game/QuizRoundPicker';
import { checkAnswer } from '@/game/QuizJudge';
import { SaveStore } from '@/core/data/save/SaveStore';
import { loadSettings, saveSettings } from '@/core/data/settings/SettingsStore';
import { getEntry } from '@/core/data/dictionary/Dictionary';
import { FxParticles } from '@/fx/Particles';
import { FxFilters } from '@/fx/Filters';
import { SpawnFx } from '@/fx/SpawnFx';
import { ensureParticleTextures } from '@/fx/particleTexture';
import { music } from '@/audio/MusicDirector';
import { sfx } from '@/audio/SoundEffects';
import { L, t } from '@/core/i18n/I18n';
import { ICON_ARROW_LEFT, ICON_RESET } from '@/ui/icons';
import { UI_FONT, SAFE_TOP } from '@/ui/paperStyle';
import type { GameEntity } from '@/game/Entity';
import type { LevelData } from '@/core/types/level';
import type { ParseCandidate } from '@/core/lex/InputParser';
import { parse } from '@/core/lex/InputParser';
import type { Question } from '@/core/types/question';
import { log } from '@/util/log';
import { hashString, mulberry32 } from '@/util/rng';

/** quiz-arena 关卡数据（import.meta.glob 构建期聚合，与 LevelManager 同源） */
const levelModules = import.meta.glob<{ default: LevelData }>('@/core/data/levels/quiz-arena.json', { eager: true });
const ARENA: LevelData = Object.values(levelModules)[0]!.default;

/** 提问生物站立位置（世界坐标，上屏中央偏上） */
const CREATURE_X = 0;
const CREATURE_Y = 320;

/** 物品生成垂直偏移（生物前方下方） */
const SPAWN_OFFSET_Y = -40;
/** 物品生成水平随机范围（以生物为中心 ±N，中央附近散落，避免堆叠同一点） */
const SPAWN_RANDOM_RANGE = 120;

/** 答对后切题延迟（ms），给动效与提示留时间 */
const NEXT_DELAY = 1200;

export class QuizScene extends Phaser.Scene {
  private phys!: Physics;
  private entities!: EntityManager;
  private tagIndex!: TagIndex;
  private spawner!: Spawner;
  private camera!: Camera;
  private environment!: Environment;
  private hud!: QuizHud;
  private bubble!: SpeechBubble;
  private keyboard!: QuizKeyboard;
  private fxFx!: FxFilters;
  private fxParticles!: FxParticles;
  private spawnFx!: SpawnFx;
  private roundPicker!: QuizRoundPicker;
  /** 生成位置随机数（种子 RNG，与题序 RNG 解耦：仅用于物品落点扰动） */
  private spawnRng!: () => number;
  private ready = false;
  private paused = false;
  /** 当前提问生物实体 */
  private creatureEntity: GameEntity | undefined;
  /** 当前题 */
  private currentQuestion: Question | undefined;
  /** 返回按钮 */
  private backBtn!: HTMLButtonElement;
  /** 换题按钮（会话内重洗，不碰存档种子） */
  private reshuffleBtn!: HTMLButtonElement;
  /** resize 节流 */
  private resizeTimer: number | undefined;

  constructor() {
    super({ key: 'QuizScene' });
  }

  async create(): Promise<void> {
    // Phaser 复用场景实例，构造函数字段初始化不会再次执行；
    // 重新进入时必须重置运行期状态（否则上次残留的 paused=true 会使返回按钮失效）
    this.ready = false;
    this.paused = false;
    // Phaser 4 不自动调用 scene.shutdown()，须显式绑到 SHUTDOWN 事件，
    // 否则切场景时 DOM 浮层（键盘/HUD/按钮）残留不清理（对齐 Phaser 生命周期标准用法）
    this.events.once('shutdown', this.shutdown, this);
    QuizHud.injectStyle();
    this.phys = new Physics(this);
    this.entities = new EntityManager();
    this.tagIndex = new TagIndex();
    this.camera = new Camera(this.cameras.main);
    this.environment = new Environment(this);

    // 渲染器已在 PreloadScene 注册，此处无需重复
    this.spawner = new Spawner(
      this,
      this.entities,
      this.phys,
      this.tagIndex,
      (_scene, e) => createEntityGraphics(this, e),
      () => this.time.now,
    );

    // 从存档读取难度 + 种子
    const save = new SaveStore();
    const saveData = await save.load();
    const tier = saveData.difficultySetting.tier;
    const standard = saveData.difficultySetting.standard;
    this.roundPicker = new QuizRoundPicker(tier, standard, saveData.questionSeed);
    // 物品落点 RNG：以 questionSeed 派生独立子流，与题序 RNG 解耦（同 seed 同落点序列）
    this.spawnRng = mulberry32(hashString(`quiz-spawn:${saveData.questionSeed}`));

    // 构建环境（视差背景 + 地面 + 装饰）
    this.environment.build(ARENA);
    // 物理地面 + 平台：Environment 只画视觉地面不建刚体，须补建静态地形承接生物，
    // 否则提问生物受重力下坠坠出世界而"消失"（对齐 LevelManager.buildTerrain）
    const groundY = ARENA.bounds.maxY;
    const groundX = (ARENA.bounds.minX + ARENA.bounds.maxX) / 2;
    const groundW = ARENA.bounds.maxX - ARENA.bounds.minX;
    this.phys.createStaticRect(groundX, groundY, groundW, 60);
    for (const t of ARENA.terrain ?? []) {
      this.phys.createStaticRect(t.x, t.y, t.w, t.h);
    }
    this.camera.clampTo = ARENA.bounds;
    this.camera.snapTo(CREATURE_X, CREATURE_Y - 100);
    music.setMood('meadow');

    // 视觉增强
    ensureParticleTextures(this);
    this.fxParticles = new FxParticles(this);
    this.fxFx = new FxFilters(this, this.cameras.main);
    this.fxFx.applyAmbience();
    this.fxFx.applyPaperGrain();
    this.spawnFx = new SpawnFx(this, this.fxParticles, this.camera);

    // UI 浮层
    this.hud = new QuizHud();
    const best = loadSettings().quizHighScore;
    this.hud.render(0, best, 0, '');
    this.bubble = new SpeechBubble();
    this._buildBackButton();
    this._buildReshuffleButton();

    // 定制键盘
    this.keyboard = new QuizKeyboard({
      onPick: (fullText) => this._onPick(fullText),
    });

    // 订阅 resize：重铺环境 + 重算相机视口（上屏高度 = 窗口高 - 键盘高）
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      if (this.resizeTimer !== undefined) window.clearTimeout(this.resizeTimer);
      this.resizeTimer = window.setTimeout(() => {
        this.environment.resize(gameSize.width, gameSize.height);
        this._applyViewport();
        this.fxFx.resize();
        this.resizeTimer = undefined;
      }, 80);
    });

    this.ready = true;
    // 首帧后应用视口（键盘已挂载，可测高度）
    this.time.delayedCall(0, () => this._applyViewport());
    // 出第一题
    this._nextQuestion();
    log.info('QuizScene.create done', { tier, standard, poolSize: this.roundPicker.hasQuestion });
  }

  update(_time: number, deltaMs: number): void {
    if (!this.ready || this.paused) return;
    const dt = Math.min(deltaMs, 50);
    void dt;
    // 物理由 Phaser Matter 自动步进
    // 环境动效（云漂移）
    this.environment.update(_time, deltaMs);
    this.fxFx.update(deltaMs);
    // 渲染同步
    for (const e of this.entities.all()) {
      const ge = e as GameEntity;
      ge.state.animTime += deltaMs;
      syncGraphics(ge);
    }
  }

  /**
   * 应用上屏视口：相机视口高度 = 窗口高度 - 键盘高度，使游戏画面只占上屏，
   * 不被下屏键盘遮挡。视口宽度仍为窗口宽度，x/y 从 0 起。
   */
  private _applyViewport(): void {
    const cam = this.cameras.main;
    const totalH = this.scale.height;
    const kbH = this.keyboard.getHeight();
    const viewH = Math.max(120, totalH - kbH);
    cam.setViewport(0, 0, this.scale.width, viewH);
    // 重新居中到提问生物（视口变化后 scroll 需重算）
    this.camera.snapTo(CREATURE_X, CREATURE_Y - 100);
    // 气泡跟随重定位
    this._positionBubble();
  }

  /** 玩家点选名词候选 / 按生成 → 复用 parse 解析形容词+名词 → 生成物品 → 判定 */
  private _onPick(fullText: string): void {
    if (!this.currentQuestion || !this.creatureEntity) return;
    // 复用 InputParser.parse 统一解析：与主游戏 Notebook 同构（DRY，不独立分词）
    const candidates = parse(fullText, 'spawn') as ParseCandidate[];
    if (candidates.length === 0) {
      log.warn('quiz parse empty', { text: fullText });
      this.hud.render(this.roundPicker.currentScore, loadSettings().quizHighScore, this.roundPicker.currentRound, t('quiz.wrong'));
      sfx.play('error');
      return;
    }
    // 取首个候选（score 最高）
    const candidate = candidates[0]!;
    // 判定
    const correct = checkAnswer(this.currentQuestion, candidate);
    // 生成物品到生物前方中央附近随机位置（避免多次答题堆叠同一点）
    const spawnX = this.creatureEntity.bodyPositionX + (this.spawnRng() * 2 - 1) * SPAWN_RANDOM_RANGE;
    const spawnY = this.creatureEntity.bodyPositionY + SPAWN_OFFSET_Y;
    const r = this.spawner.spawnCandidate(candidate, spawnX, spawnY);
    if (r.reason) {
      log.warn('quiz spawn rejected', { reason: r.reason });
      this.hud.render(this.roundPicker.currentScore, loadSettings().quizHighScore, this.roundPicker.currentRound, t('quiz.wrong'));
      return;
    }
    if (r.entity?.gameObject) this.phys.attachBody(r.entity.gameObject, r.entity.body);
    // 生成动效
    const cam = this.camera.cam;
    const fxSx = (spawnX - cam.scrollX) * cam.zoom + cam.x;
    const fxSy = (spawnY - cam.scrollY) * cam.zoom + cam.y;
    if (r.entity) this.spawnFx.playSpawn(r.entity, fxSx, fxSy);

    if (correct) {
      // 答对：积分+1，登记 ttl，切下一题
      this.roundPicker.scoreUp();
      if (r.entity) this.roundPicker.trackItem(r.entity.id);
      const score = this.roundPicker.currentScore;
      const best = this._updateHighScore(score);
      this.hud.render(score, best, this.roundPicker.currentRound, t('quiz.correct'));
      sfx.play('questComplete');
      // 延迟切题，给动效留时间
      this.time.delayedCall(NEXT_DELAY, () => this._nextQuestion());
    } else {
      // 答错：物品仍登记 ttl（3 回合后消失），不切题，可重试
      if (r.entity) this.roundPicker.trackItem(r.entity.id);
      this.hud.render(this.roundPicker.currentScore, loadSettings().quizHighScore, this.roundPicker.currentRound, t('quiz.wrong'));
      sfx.play('error');
    }
  }

  /** 切下一题：推进回合（物品 ttl 递减 + 过期销毁）→ 换生物 → 出新题面 */
  private _nextQuestion(): void {
    if (!this.roundPicker.hasQuestion) {
      log.warn('quiz pool empty');
      return;
    }
    // 推进一回合：物品 ttl-1，过期销毁
    this.roundPicker.tickItems((entityId) => this._expireItem(entityId));

    const state = this.roundPicker.next();
    if (!state) return;
    this.currentQuestion = state.question;

    // 换提问生物：销毁旧的，生成新的
    if (this.creatureEntity) {
      this._destroyEntity(this.creatureEntity);
      this.creatureEntity = undefined;
    }
    const entry = getEntry(state.creature.id);
    if (entry) {
      const r = this.spawner.spawnEntry(entry, undefined, CREATURE_X, CREATURE_Y, undefined, 'levelSpawn');
      if (r.entity) {
        r.entity.critical = true;
        this.creatureEntity = r.entity;
        if (r.entity.gameObject) this.phys.attachBody(r.entity.gameObject, r.entity.body);
      }
    }

    // 展示题面（气泡定位到生物头顶，固定屏幕位置）
    const prompt = L(state.question.prompt);
    const hint = state.question.hint ? L(state.question.hint) : t('quiz.hint');
    this.bubble.show(prompt, hint);
    this._positionBubble();

    // 刷新 HUD
    const best = loadSettings().quizHighScore;
    this.hud.render(this.roundPicker.currentScore, best, state.round, '');
    log.info('quiz next question', { round: state.round, creature: state.creature.id, q: state.question.id });
  }

  /** 物品过期销毁：GameObject + body + 实体索引 */
  private _expireItem(entityId: string): void {
    const e = this.entities.get(entityId) as GameEntity | undefined;
    if (!e) return;
    this._destroyEntity(e);
    log.info('quiz item expired', { id: entityId });
  }

  /** 销毁一个实体（GameObject + body + 索引） */
  private _destroyEntity(e: GameEntity): void {
    if (e.gameObject) e.gameObject.destroy();
    else this.phys.removeBody(e.body);
    this.tagIndex.detach(e, e.tags);
    this.entities.remove(e.id);
  }

  /** 更新最高分（持久化） */
  private _updateHighScore(score: number): number {
    const settings = loadSettings();
    if (score > settings.quizHighScore) {
      saveSettings({ ...settings, quizHighScore: score });
      return score;
    }
    return settings.quizHighScore;
  }

  /** 气泡定位到提问生物头顶（屏幕固定位置，不跟随相机） */
  private _positionBubble(): void {
    if (!this.creatureEntity) return;
    // 用相机把世界坐标转屏幕坐标，气泡复用 SpeechBubble.positionAt
    this.bubble.positionAt(this.creatureEntity.bodyPositionX, this.creatureEntity.bodyPositionY, this.camera);
  }

  /** 构建返回按钮（右上角，fixed） */
  private _buildBackButton(): void {
    this.backBtn = document.createElement('button');
    this.backBtn.type = 'button';
    this.backBtn.innerHTML = `${ICON_ARROW_LEFT}<span style="margin-left:6px">${t('quiz.back')}</span>`;
    this.backBtn.style.cssText = [
      'position:fixed',
      `top:${SAFE_TOP}`,
      `right:max(14px,env(safe-area-inset-right))`,
      'z-index:51',
      'display:flex',
      'align-items:center',
      'gap:6px',
      `font-family:${UI_FONT}`,
      'font-size:14px',
      'font-weight:900',
      'color:#fff8dd',
      'background:linear-gradient(135deg,#3ab5a0,#1a7a6a)',
      'border:2px solid #0d3a30',
      'border-radius:999px',
      'padding:8px 16px',
      'cursor:pointer',
      'box-shadow:0 4px 12px rgba(0,0,0,0.4)',
      'pointer-events:auto',
    ].join(';');
    this.backBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      this._backToTitle();
    });
    document.body.appendChild(this.backBtn);

    // ESC 返回
    const kb = this.input.keyboard;
    if (kb) {
      kb.on('keydown-ESC', (e: KeyboardEvent) => {
        e.preventDefault();
        this._backToTitle();
      });
    }
  }

  /** 构建换题按钮（右上角返回按钮左侧，会话内重洗题序与提问生物，不碰存档种子） */
  private _buildReshuffleButton(): void {
    this.reshuffleBtn = document.createElement('button');
    this.reshuffleBtn.type = 'button';
    this.reshuffleBtn.innerHTML = `${ICON_RESET}<span style="margin-left:6px">${t('quiz.reshuffle')}</span>`;
    this.reshuffleBtn.style.cssText = [
      'position:fixed',
      `top:${SAFE_TOP}`,
      `right:calc(max(14px,env(safe-area-inset-right)) + 140px)`,
      'z-index:51',
      'display:flex',
      'align-items:center',
      'gap:6px',
      `font-family:${UI_FONT}`,
      'font-size:14px',
      'font-weight:900',
      'color:#3a2a1a',
      'background:linear-gradient(135deg,#f7d56a,#e0a93a)',
      'border:2px solid #5a3d0a',
      'border-radius:999px',
      'padding:8px 16px',
      'cursor:pointer',
      'box-shadow:0 4px 12px rgba(0,0,0,0.4)',
      'pointer-events:auto',
    ].join(';');
    this.reshuffleBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      this._reshuffle();
    });
    document.body.appendChild(this.reshuffleBtn);
  }

  /** 返回标题页 */
  private _backToTitle(): void {
    if (this.paused) return;
    this.paused = true;
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(320, () => {
      this.scene.start('TitleScene');
    });
  }

  /**
   * 会话内换题：清场上所有生成物品 → 重洗题序与提问生物序列 → 重出第一题。
   * 不碰存档种子，不影响主游戏题序；当前局分数清零，最高分保留。
   */
  private _reshuffle(): void {
    if (this.paused) return;
    // 清场上所有生成物品（creature 除外，creature 由 _nextQuestion 重建）
    for (const e of this.entities.all()) {
      const ge = e as GameEntity;
      if (ge === this.creatureEntity) continue;
      this._destroyEntity(ge);
    }
    this.roundPicker.reshuffle();
    this.keyboard.clear();
    sfx.play('ui');
    this._nextQuestion();
    log.info('quiz reshuffle applied');
  }

  shutdown(): void {
    this.keyboard?.destroy();
    this.bubble?.hide();
    this.hud?.hide();
    this._disposeDom();
    if (this.resizeTimer !== undefined) window.clearTimeout(this.resizeTimer);
    this.roundPicker?.clearItems();
    log.info('QuizScene shutdown');
  }

  /** 移除本场景挂载的 DOM 浮层（返回 / 换题按钮），幂等可重复调用 */
  private _disposeDom(): void {
    this.backBtn?.remove();
    this.reshuffleBtn?.remove();
  }
}
