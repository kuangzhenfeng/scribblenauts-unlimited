/**
 * 简易问答场景 —— 面向手机竖屏的问答玩法（学习 App 风）。
 *
 * 三段式布局（顶栏 / 词汇任务卡 / 画布 / 键盘卡）：
 *  - QuizTopBar：返回 + 题序/得分/最高分徽章 + 换题
 *  - QuizQuestionCard：等级档/词频标准 + 难度档位切换 + 题面 + 操作提示
 *  - 画布：Phaser 视差背景 + 提问生物 + 生成物品物理交互（趣味内核）
 *  - QuizKeyboard：干净现代风定制键盘
 *
 * 与 WorldScene 的差异：无玩家/NPC 对话/规则引擎/行为系统/MousePicker/
 * TouchControls，只保留物理/生成/渲染/环境/动效的最小子集 + 问答循环。
 * 答案判定用 QuizJudge（闭集匹配纯函数），回合管理用 QuizRoundPicker。
 * 难度切换：在任务卡内切换等级档/词频标准与基础/进阶/大师档位，即时重建题池。
 * 暂停：ESC 返回标题页（简易模式无复杂暂停态，直接退出）。
 */

import Phaser from 'phaser';
import { EntityManager } from '@/game/EntityManager';
import { TagIndex } from '@/core/rules/TagIndex';
import { Spawner } from '@/game/Spawner';
import type { Physics } from '@/engine/physics/Physics';
import { Camera } from '@/engine/render/Camera';
import { createEntityGraphics, syncGraphics } from '@/engine/render/EntityGraphics';
import { hexToNum } from '@/engine/render/VectorDraw';
import { QuizKeyboard } from '@/ui/QuizKeyboard';
import { QuizHud } from '@/ui/QuizHud';
import { QuizTopBar } from '@/ui/QuizTopBar';
import { QuizQuestionCard } from '@/ui/QuizQuestionCard';
import { QUIZ_BG_TOP, QUIZ_BG_BOTTOM, QUIZ_STAGE_LINE } from '@/ui/quizStyle';
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
import { L, t, type Lang } from '@/core/i18n/I18n';
import type { GameEntity } from '@/game/Entity';
import type { LevelData } from '@/core/types/level';
import type { ParseCandidate } from '@/core/lex/InputParser';
import { parse } from '@/core/lex/InputParser';
import type { Question, DifficultyTier, DifficultyStandard } from '@/core/types/question';
import { log } from '@/util/log';
import { generateSeed, hashString, mulberry32 } from '@/util/rng';

/** quiz-arena 关卡数据（import.meta.glob 构建期聚合，与 LevelManager 同源） */
const levelModules = import.meta.glob<{ default: LevelData }>('@/core/data/levels/quiz-arena.json', { eager: true });
const ARENA: LevelData = Object.values(levelModules)[0]!.default;

/** 为每次进入简易模式创建独立会话种子，避免复用存档中的上一轮题序。 */
export function createQuizSessionSeed(previousSeed: string): string {
  const seed = generateSeed();
  return seed === previousSeed ? `${seed}-quiz` : seed;
}

/** 提问生物站立位置（世界坐标，上屏中央偏上） */
const CREATURE_X = 0;
const CREATURE_Y = 320;

/** 物品生成垂直偏移（生物前方下方） */
const SPAWN_OFFSET_Y = -40;
/** 物品生成水平随机范围（以生物为中心 ±N，中央附近散落，避免堆叠同一点） */
const SPAWN_RANDOM_RANGE = 120;

/** 答对后切题延迟（ms），给动效与提示留时间 */
const NEXT_DELAY = 1200;

/**
 * 无物理占位 body 工厂 —— 简易模式不实例化 Matter Physics，生物与物品为纯视觉 sprite。
 *
 * Spawner 与主游戏共享、硬依赖 Physics 接口（createBody/attachBody/bindEntity）。
 * 此处注入一个满足该接口子集的轻量对象：createBody 返回纯数据占位 body（形如
 * `{position:{x,y},angle:0,id}`），attachBody/bindEntity 为 no-op。
 * GameEntity 的 bodyPositionX/Y/bodyAngle getter 读占位 body 的 position 正常工作，
 * EntityGraphics/SpawnFx 只经 getter 取位，不直接碰 Physics API，渲染与动效完全正常。
 * 不污染主游戏 Physics 类（仅简易模式用，剃刀原则：最小薄封装，不新增适配器类）。
 */
function createNoPhysicsStub(): Physics {
  let bodyId = 100000;
  const stub = {
    createBody: (_spec: unknown, _size: unknown, x: number, y: number) =>
      ({ position: { x, y }, angle: 0, id: ++bodyId }),
    attachBody: () => {},
    bindEntity: () => {},
    removeBody: () => {},
    createStaticRect: () => ({}),
  };
  return stub as unknown as Physics;
}

export class QuizScene extends Phaser.Scene {
  private entities!: EntityManager;
  private tagIndex!: TagIndex;
  private spawner!: Spawner;
  private camera!: Camera;
  private topBar!: QuizTopBar;
  private questionCard!: QuizQuestionCard;
  private hud!: QuizHud;
  private keyboard!: QuizKeyboard;
  private fxFx!: FxFilters;
  private fxParticles!: FxParticles;
  private spawnFx!: SpawnFx;
  private roundPicker!: QuizRoundPicker;
  /** 固定屏漫画舞台背景；纹理缺失时保留渐变回退。 */
  private backgroundImage: Phaser.GameObjects.Image | undefined;
  /** 生成位置随机数（种子 RNG，与题序 RNG 解耦：仅用于物品落点扰动） */
  private spawnRng!: () => number;
  /** 生物 idle 呼吸 tween 引用（切题时销毁重建） */
  private creatureIdleTween: Phaser.Tweens.Tween | undefined;
  private ready = false;
  private paused = false;
  /** 当前提问生物实体 */
  private creatureEntity: GameEntity | undefined;
  /** 当前题 */
  private currentQuestion: Question | undefined;
  /** 当前难度档位（随任务卡切换变化） */
  private tier!: DifficultyTier;
  /** 当前难度标准（随任务卡切换变化） */
  private standard!: DifficultyStandard;
  /** 本次简易模式会话种子（难度切换时重建题池用） */
  private questionSeed!: string;
  /** 显式重置种子后重启场景时复用，避免一次进入生成两次种子 */
  private pendingQuestionSeed: string | undefined;
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
    // 否则切场景时 DOM 浮层（顶栏/任务卡/键盘/HUD）残留不清理（对齐 Phaser 生命周期标准用法）
    this.events.once('shutdown', this.shutdown, this);
    QuizHud.injectStyle();
    this.entities = new EntityManager();
    this.tagIndex = new TagIndex();
    this.camera = new Camera(this.cameras.main);

    // 渲染器已在 PreloadScene 注册，此处无需重复
    // 无物理模式：注入占位 stub 替代真实 Physics，生物/物品为纯视觉 sprite（无 Matter body）
    this.spawner = new Spawner(
      this,
      this.entities,
      createNoPhysicsStub(),
      this.tagIndex,
      (_scene, e) => createEntityGraphics(this, e),
      () => this.time.now,
    );

    // 从存档读取难度；简易模式每次进入使用新的会话种子，不改全局存档种子。
    const save = new SaveStore();
    const saveData = await save.load();
    this.tier = saveData.difficultySetting.tier;
    this.standard = saveData.difficultySetting.standard;
    this.questionSeed = this.pendingQuestionSeed ?? createQuizSessionSeed(saveData.questionSeed);
    this.pendingQuestionSeed = undefined;
    this.roundPicker = new QuizRoundPicker(this.tier, this.standard, this.questionSeed, loadSettings().filterBasicQuestions);
    // 物品落点 RNG：以 questionSeed 派生独立子流，与题序 RNG 解耦（同 seed 同落点序列）
    this.spawnRng = mulberry32(hashString(`quiz-spawn:${this.questionSeed}`));

    // 漫画舞台：生成背景图优先，米白渐变作为纹理缺失回退。
    this.cameras.main.setBackgroundColor(QUIZ_BG_TOP);
    this._buildCanvasBackground();
    this._buildStage();
    this.camera.clampTo = ARENA.bounds;
    this.camera.snapTo(CREATURE_X, CREATURE_Y - 100);
    music.setMood('meadow');

    // 视觉增强：保留粒子与生成动效（趣味性来源），跳过纸感氛围滤镜（学习软件要真实色彩）
    ensureParticleTextures(this);
    this.fxParticles = new FxParticles(this);
    this.fxFx = new FxFilters(this, this.cameras.main);
    this.spawnFx = new SpawnFx(this, this.fxParticles, this.camera);

    // UI 浮层：顶栏 / 任务卡 / toast
    this.topBar = new QuizTopBar(this.tier, this.standard, {
      onBack: () => this._backToTitle(),
      onReshuffle: () => this._reshuffle(),
      onDifficulty: (tier, standard) => this._onDifficulty(tier, standard),
      onLanguage: (lang) => this._onLanguage(lang),
      onSeedReset: () => this._resetQuestionSeed(),
      onFilterBasicChange: (next) => this._onFilterBasicChange(next),
    });
    this.topBar.render(0, 0, 0);
    this.questionCard = new QuizQuestionCard();
    this.hud = new QuizHud();

    // 定制键盘
    this.keyboard = new QuizKeyboard({
      onPick: (fullText) => this._onPick(fullText),
    });

    // 订阅 resize：重算相机视口（视口 = 窗口高 - 顶栏 - 任务卡 - 键盘）
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      if (this.resizeTimer !== undefined) window.clearTimeout(this.resizeTimer);
      this.resizeTimer = window.setTimeout(() => {
        void gameSize;
        this._applyViewport();
        this.fxFx.resize();
        this.resizeTimer = undefined;
      }, 80);
    });

    this.ready = true;
    // 顶栏/任务卡/键盘已挂载，立即钉位任务卡并应用视口（顶栏高度可同步测得）
    this._applyViewport();
    // 出第一题
    this._nextQuestion();
    log.info('QuizScene.create done', { tier: this.tier, standard: this.standard, poolSize: this.roundPicker.hasQuestion });
  }

  update(_time: number, deltaMs: number): void {
    if (!this.ready || this.paused) return;
    const dt = Math.min(deltaMs, 50);
    void dt;
    // 无物理：不步进 Matter（未实例化）；仅渲染同步与 FX
    this.fxFx.update(deltaMs);
    // 渲染同步
    for (const e of this.entities.all()) {
      const ge = e as GameEntity;
      ge.state.animTime += deltaMs;
      syncGraphics(ge);
    }
  }

  /**
   * 应用画布视口：舞台从顶栏下方开始，委托条悬浮覆盖在舞台上；
   * 只有下屏输入台从舞台高度中扣除，保证题面与背景形成同一层级。
   */
  private _applyViewport(): void {
    const cam = this.cameras.main;
    const totalH = this.scale.height;
    const topH = this.topBar?.getHeight() ?? 0;
    // 任务卡为 position:fixed 但不自带 top，须按顶栏实测高度钉位，否则落入文档流末尾
    this.questionCard?.setTop(topH);
    const cardH = this.questionCard?.getHeight() ?? 0;
    // 竖屏时题面悬浮在舞台上；横屏优先让输入台贴底，只有空间不足时才改为从题面下方滚动。
    const stageTop = topH;
    const keyboardTop = topH + cardH;
    const landscape = this.scale.width > totalH;
    this.keyboard?.setLandscapeTop(undefined);
    const naturalKeyboardHeight = this.keyboard?.getHeight() ?? 0;
    const naturalKeyboardTop = totalH - naturalKeyboardHeight;
    if (landscape && naturalKeyboardTop < keyboardTop + 6) {
      this.keyboard?.setLandscapeTop(keyboardTop + 6);
    }
    const kbH = this.keyboard?.getHeight() ?? 0;
    const minViewH = this.scale.width > totalH ? 0 : 120;
    const viewH = Math.max(minViewH, totalH - stageTop - kbH);
    cam.setViewport(0, stageTop, this.scale.width, viewH);
    this._coverBackground(cam.width, cam.height);
    // 重新居中到提问生物（视口变化后 scroll 需重算）
    this.camera.snapTo(CREATURE_X, CREATURE_Y - 100);
  }

  /**
   * 画布纵向渐变底 —— 米白→略深米色，制造空间纵深而不喧宾夺主。
   * 固定屏（scrollFactor 0,0），覆盖整个视口，resize 无需重建（Graphics 自动跟随相机尺寸）。
   */
  private _buildCanvasBackground(): void {
    const g = this.add.graphics();
    // fillGradientStyle(topLeft, topRight, bottomLeft, bottomRight) 纵向渐变
    g.fillGradientStyle(
      hexToNum(QUIZ_BG_TOP),
      hexToNum(QUIZ_BG_TOP),
      hexToNum(QUIZ_BG_BOTTOM),
      hexToNum(QUIZ_BG_BOTTOM),
      1,
    );
    // 覆盖一个足够大的世界区域（相机 clampTo ARENA.bounds）
    const cx = (ARENA.bounds.minX + ARENA.bounds.maxX) / 2;
    const cy = (ARENA.bounds.minY + ARENA.bounds.maxY) / 2;
    const w = ARENA.bounds.maxX - ARENA.bounds.minX;
    const h = ARENA.bounds.maxY - ARENA.bounds.minY;
    g.fillRect(cx - w / 2, cy - h / 2, w, h);
    g.setScrollFactor(0, 0);
    g.setDepth(-50);
    if (this.textures.exists('quiz-upper-bg')) {
      this.backgroundImage = this.add.image(0, 0, 'quiz-upper-bg');
      this.backgroundImage.setOrigin(0.5, 0.5);
      this.backgroundImage.setScrollFactor(0, 0);
      this.backgroundImage.setDepth(-49);
    }
  }

  /** 独立按当前相机视口 cover，避免把整页高度误用于舞台背景缩放。 */
  private _coverBackground(width: number, height: number): void {
    if (!this.backgroundImage) return;
    const source = this.backgroundImage.texture.getSourceImage() as { width: number; height: number };
    const scale = Math.max(width / source.width, height / source.height);
    this.backgroundImage.setPosition(width / 2, height / 2);
    this.backgroundImage.setScale(scale);
  }

  /**
   * 精致站位分隔线 —— 学习 App 风替代游戏舞台底与物理地面。
   * 生物脚下一条 1px 暖灰线 + 下方淡阴影渐变区，指示生物站位；
   * 无物理刚体（去物理化），纯视觉承接。静态 Graphics 不依赖窗口尺寸，resize 无需重建。
   */
  private _buildStage(): void {
    const g = this.add.graphics();
    const w = ARENA.bounds.maxX - ARENA.bounds.minX;
    const lineY = ARENA.bounds.maxY - 8;
    // 站位线
    g.lineStyle(1, hexToNum(QUIZ_STAGE_LINE), 1);
    g.beginPath();
    g.moveTo(ARENA.bounds.minX, lineY);
    g.lineTo(ARENA.bounds.maxX, lineY);
    g.strokePath();
    // 下方淡阴影区（轻微填充，制造"地面"感而不厚重）
    g.fillStyle(hexToNum(QUIZ_STAGE_LINE), 0.15);
    g.fillRect(ARENA.bounds.minX, lineY, w, 40);
    g.setScrollFactor(1, 1);
    g.setDepth(-10);
  }

  /** 玩家点选名词候选 / 按生成 → 复用 parse 解析形容词+名词 → 生成物品 → 判定 */
  private _onPick(fullText: string): void {
    if (!this.currentQuestion || !this.creatureEntity) return;
    // 复用 InputParser.parse 统一解析：与主游戏 Notebook 同构（DRY，不独立分词）
    const candidates = parse(fullText, 'spawn') as ParseCandidate[];
    if (candidates.length === 0) {
      log.warn('quiz parse empty', { text: fullText });
      this.roundPicker.recordWrong();
      this.hud.render(t('quiz.wrong'));
      this.topBar.render(this.roundPicker.currentRound, this.roundPicker.currentScore, this.roundPicker.currentStreak);
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
      this.roundPicker.recordWrong();
      this.hud.render(t('quiz.wrong'));
      this.topBar.render(this.roundPicker.currentRound, this.roundPicker.currentScore, this.roundPicker.currentStreak);
      return;
    }
    // 无物理：不挂 body（占位 body 已由 stub 提供），GameObject 由 createEntityGraphics 创建即就位
    // 生成动效
    const cam = this.camera.cam;
    const fxSx = (spawnX - cam.scrollX) * cam.zoom + cam.x;
    const fxSy = (spawnY - cam.scrollY) * cam.zoom + cam.y;
    if (r.entity) this.spawnFx.playSpawn(r.entity, fxSx, fxSy);

    if (correct) {
      // 答对：积分+1，登记 ttl，切下一题，生物开心弹跳
      this.roundPicker.recordCorrect();
      if (r.entity) this.roundPicker.trackItem(r.entity.id);
      const score = this.roundPicker.currentScore;
      this._updateHighScore(score);
      this.hud.render(t('quiz.correct'));
      this.topBar.render(this.roundPicker.currentRound, score, this.roundPicker.currentStreak);
      sfx.play('questComplete');
      this._playCreatureHappy();
      // 延迟切题，给动效留时间
      this.time.delayedCall(NEXT_DELAY, () => this._nextQuestion());
    } else {
      // 答错：物品仍登记 ttl（3 回合后消失），不切题，可重试
      this.roundPicker.recordWrong();
      if (r.entity) this.roundPicker.trackItem(r.entity.id);
      this.hud.render(t('quiz.wrong'));
      this.topBar.render(this.roundPicker.currentRound, this.roundPicker.currentScore, this.roundPicker.currentStreak);
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
        // 无物理：不挂 body，sprite 由 createEntityGraphics 就位于占位 body 的 position
        this._playCreatureIdle();
      }
    }

    // 展示题面（写入任务卡，含难度档与提示）
    const prompt = L(state.question.prompt);
    const hint = state.question.hint ? L(state.question.hint) : t('quiz.hint');
    this.questionCard.setQuestion(prompt, hint);
    // 题面长度会改变委托条高度，必须立即重算横屏输入台与舞台视口。
    this._applyViewport();
    this.topBar.render(state.round, this.roundPicker.currentScore, this.roundPicker.currentStreak);
    log.info('quiz next question', { round: state.round, creature: state.creature.id, q: state.question.id });
  }

  /**
   * 难度切换：重建题池并重出第一题。
   * 持久化新难度到存档，清场上生成物品，重置分数（难度变化视为新一局，最高分保留）。
   */
  private async _onDifficulty(tier: DifficultyTier, standard: DifficultyStandard): Promise<void> {
    if (this.paused) return;
    this.tier = tier;
    this.standard = standard;
    // 持久化（与主游戏设置页一致：updateDifficultySetting）
    const save = new SaveStore();
    await save.updateDifficultySetting(tier, standard);
    // 清场上生成物品（creature 除外，由 _nextQuestion 重建）
    for (const e of this.entities.all()) {
      const ge = e as GameEntity;
      if (ge === this.creatureEntity) continue;
      this._destroyEntity(ge);
    }
    this.roundPicker = new QuizRoundPicker(tier, standard, this.questionSeed, loadSettings().filterBasicQuestions);
    this.keyboard.clear();
    this._applyViewport();
    this._nextQuestion();
    log.info('quiz difficulty changed', { tier, standard, poolSize: this.roundPicker.hasQuestion });
  }

  /**
   * 切换 A1 基础题过滤：持久化设置并重建题池（与切难度同流程）。
   * 答案全为 CEFR A1 级词汇的题目在开启时被排除。
   */
  private async _onFilterBasicChange(next: boolean): Promise<void> {
    if (this.paused) return;
    saveSettings({ ...loadSettings(), filterBasicQuestions: next });
    // 清场上生成物品（creature 除外，由 _nextQuestion 重建）
    for (const e of this.entities.all()) {
      const ge = e as GameEntity;
      if (ge === this.creatureEntity) continue;
      this._destroyEntity(ge);
    }
    this.roundPicker = new QuizRoundPicker(this.tier, this.standard, this.questionSeed, next);
    this.keyboard.clear();
    this._applyViewport();
    this._nextQuestion();
    log.info('quiz filter basic changed', { filterBasic: next, poolSize: this.roundPicker.hasQuestion });
  }

  /** 语言属于全局设置，只刷新浮层文案，保留当前题目与回合状态。 */
  private _onLanguage(lang: Lang): void {
    const question = this.currentQuestion;
    if (question) {
      const prompt = L(question.prompt);
      const hint = question.hint ? L(question.hint) : t('quiz.hint');
      this.questionCard.refreshLocale(prompt, hint);
    }
    this.keyboard.refreshLocale();
    this.topBar.refreshLocale(
      this.roundPicker.currentRound,
      this.roundPicker.currentScore,
      this.roundPicker.currentStreak,
    );
    this._applyViewport();
    log.info('quiz language changed', { lang, round: this.roundPicker.currentRound });
  }

  /** 重置题目随机种子，清理旧题目进度后重新进入问答模式。 */
  private async _resetQuestionSeed(): Promise<void> {
    if (this.paused) return;
    const store = new SaveStore();
    const seed = generateSeed();
    await store.updateQuestionSeed(seed);
    await store.clearChallengeProgress();
    this.pendingQuestionSeed = seed;
    log.info('quiz question seed reset');
    this.scene.restart();
  }

  /** 物品过期销毁：GameObject + 实体索引（无物理：无 body 可移除） */
  private _expireItem(entityId: string): void {
    const e = this.entities.get(entityId) as GameEntity | undefined;
    if (!e) return;
    this._destroyEntity(e);
    log.info('quiz item expired', { id: entityId });
  }

  /** 销毁一个实体（GameObject + 索引；无物理：不操作 body） */
  private _destroyEntity(e: GameEntity): void {
    e.gameObject?.destroy();
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

  /**
   * 生物 idle 呼吸动效 —— 去物理后生物不再晃动，用轻微 y 轴呼吸维持"活着"的感觉。
   * syncGraphics 每帧用 entity.bodyPositionY 覆盖 sprite.y，故直接 tween 占位 body 的
   * position.y（getter 读此值），呼吸即经 syncGraphics 同步到 sprite。切题时由调用方先销毁旧 tween。
   */
  private _playCreatureIdle(): void {
    this.creatureIdleTween?.remove();
    const body = this.creatureEntity?.body as { position: { x: number; y: number } } | undefined;
    if (!body) return;
    const baseY = body.position.y;
    this.creatureIdleTween = this.tweens.add({
      targets: body.position,
      y: baseY - 3,
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  /** 答对时生物开心弹跳（一次性，作用于占位 body.position.y，经 syncGraphics 同步到 sprite） */
  private _playCreatureHappy(): void {
    const body = this.creatureEntity?.body as { position: { x: number; y: number } } | undefined;
    if (!body) return;
    const baseY = body.position.y;
    // 先停 idle，避免叠加
    this.creatureIdleTween?.remove();
    this.creatureIdleTween = undefined;
    this.tweens.add({
      targets: body.position,
      y: baseY - 18,
      duration: 200,
      yoyo: true,
      ease: 'Quad.out',
      onComplete: () => {
        body.position.y = baseY;
        this._playCreatureIdle();
      },
    });
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
    this.hud?.destroy();
    this.topBar?.destroy();
    this.questionCard?.destroy();
    this.creatureIdleTween?.remove();
    if (this.resizeTimer !== undefined) window.clearTimeout(this.resizeTimer);
    this.roundPicker?.clearItems();
    log.info('QuizScene shutdown');
  }
}
