/**
 * 平台适配层
 *
 * 背景：整套四维分析最初是为抖音（15–60 秒短视频、只有标题文本）校准的。
 * 切到 B站（1–20 分钟中长视频、有分区/简介）后，直接套用会出现系统性误判：
 *   - 时长：127s 与 1259s 都被判成「长(>60s)」，没有区分度
 *   - 语速/信息密度：B站不返回字幕，标题字数 ÷ 时长 ≈ 0.1，全部落「慢节奏 + 低密度」
 *   - 题材：标题关键词命中不了，80% 落入「其他/综合」
 *   - 形式：无关键词命中就默认兜底「口播」，90% 都是口播
 *
 * 解决：把平台差异集中在这里，分析器只消费参数，不写死阈值。
 */

/** 平台参数 */
export const PLATFORMS = {
  douyin: {
    id: 'douyin',
    name: '抖音',
    /** 时长分档：按 max 升序，取第一个满足的 */
    durationTags: [
      { max: 15, id: 'dur_ultrashort' },
      { max: 30, id: 'dur_short' },
      { max: 60, id: 'dur_medium' },
      { max: Infinity, id: 'dur_long' },
    ],
    /** 该平台能否算语速与信息密度（需要字幕/口播稿，B站拿不到） */
    rhythmMetrics: { speed: true, density: true },
    speedThresholds: { fast: 1.2, medium: 0.6 },
    densityThresholds: { high: 0.12, medium: 0.05 },
    /** 判定"有中段"的最短时长 */
    minMiddleDuration: 15,
    /** 能否按日期回溯历史。抖音通道与第三方数据商通常支持 {{date}} 占位符 */
    supportsHistory: true,
  },
  bilibili: {
    id: 'bilibili',
    name: '哔哩哔哩',
    short: 'B站',
    durationTags: [
      { max: 60, id: 'dur_b_short' },
      { max: 180, id: 'dur_b_medium' },
      { max: 600, id: 'dur_b_long' },
      { max: Infinity, id: 'dur_b_xlong' },
    ],
    // 无字幕通道：标题字数不能代表口播稿长度，这两个指标在 B站不成立，直接不出标签
    rhythmMetrics: { speed: false, density: false },
    speedThresholds: { fast: 1.2, medium: 0.6 },
    densityThresholds: { high: 0.12, medium: 0.05 },
    minMiddleDuration: 60,
    // B站公开接口只返回「此刻热门」，没有日期参数。
    // 若强行回溯，补出来的每一天都是同一批数据 —— 趋势曲线会变成假的直线。
    supportsHistory: false,
  },
};

/**
 * B站分区（tname）→ 题材
 * 分区是 B站官方打的标签，比从标题猜词可靠得多，属于白送的真实题材信号。
 * 值为 null 表示"这个分区映射不到 18 个题材之一"，此时不强行高置信，交给关键词兜底。
 */
export const BILI_TOPIC_MAP = {
  // 搞笑 / 娱乐
  搞笑: 'topic_comedy',
  鬼畜: 'topic_comedy',
  小剧场: 'topic_drama',
  短片: 'topic_drama',
  // 音乐
  MV: 'topic_music',
  音乐现场: 'topic_music',
  原创音乐: 'topic_music',
  音乐综合: 'topic_music',
  音乐: 'topic_music',
  翻唱: 'topic_music',
  // 动画 / 影视
  国产动画: 'topic_animation',
  动画: 'topic_animation',
  番剧: 'topic_animation',
  国创: 'topic_animation',
  影视: 'topic_animation',
  纪录片: 'topic_animation',
  短片·手书: 'topic_animation',
  // 美食
  美食制作: 'topic_food',
  田园美食: 'topic_food',
  美食: 'topic_food',
  // 知识 / 人文
  知识: 'topic_knowledge',
  '社科·法律·心理': 'topic_knowledge',
  财经商业: 'topic_knowledge',
  人文历史: 'topic_knowledge',
  校园学习: 'topic_knowledge',
  职业职场: 'topic_career',
  职场: 'topic_career',
  // 科技
  科技数码: 'topic_tech',
  数码: 'topic_tech',
  软件应用: 'topic_tech',
  电脑硬件: 'topic_tech',
  // 游戏
  单机游戏: 'topic_game',
  手机游戏: 'topic_game',
  网络游戏: 'topic_game',
  电子竞技: 'topic_game',
  // 生活 / 旅行
  出行: 'topic_travel',
  旅游: 'topic_travel',
  // 运动
  运动综合: 'topic_fitness',
  健身: 'topic_fitness',
  // 颜值 / 时尚
  时尚潮流: 'topic_fashion',
  美妆护肤: 'topic_beauty',
  // 情感 / 亲子
  情感: 'topic_emotion',
  亲子: 'topic_parenting',
  育儿: 'topic_parenting',
  // 三农
  '三农': 'topic_rural',
  // 汽车
  汽车: 'topic_auto',
  // 动物
  动物圈: 'topic_pet',
  萌宠: 'topic_pet',
  // 国风
  国风: 'topic_guofeng',
  汉服: 'topic_guofeng',
};

/**
 * B站分区 → 常见表现形式（弱先验，置信度低于关键词命中）
 * 只填"分区本身就能说明形式"的，不硬猜。
 */
export const BILI_CRAFT_MAP = {
  单机游戏: ['form_slideshow'],
  网络游戏: ['form_slideshow'],
  手机游戏: ['form_slideshow'],
  电子竞技: ['form_slideshow'],
  MV: ['form_beat'],
  音乐现场: ['form_beat'],
  原创音乐: ['form_beat'],
  音乐综合: ['form_beat'],
  舞蹈综合: ['form_dance'],
  宅舞: ['form_dance'],
  美食制作: ['form_vlog'],
  田园美食: ['form_vlog'],
  出行: ['form_vlog'],
  日常: ['form_vlog'],
  知识: ['form_talking'],
  '社科·法律·心理': ['form_talking'],
  财经商业: ['form_talking'],
  人文历史: ['form_talking'],
  职业职场: ['form_talking'],
  小剧场: ['form_acting'],
  搞笑: ['form_acting'],
  绘画: ['form_slideshow'],
  '同人·手书': ['form_slideshow'],
  音乐: ['form_beat'],
  翻唱: ['form_beat'],
  国产动画: ['form_slideshow'],
  动画: ['form_slideshow'],
  番剧: ['form_slideshow'],
  影视: ['form_slideshow'],
};

/**
 * 判定数据源所属平台。
 * 优先用显式配置 CUSTOM_PLATFORM，其次按 URL 猜，最后兜底抖音。
 */
export function detectPlatform(url = '', explicit = '') {
  if (explicit && PLATFORMS[explicit]) return explicit;
  if (/bilibili|b23\.tv|bili/i.test(url)) return 'bilibili';
  if (/douyin|iesdouyin|aweme/i.test(url)) return 'douyin';
  return 'douyin';
}

export function getPlatform(id) {
  return PLATFORMS[id] || PLATFORMS.douyin;
}

/** 按平台取时长标签 id */
export function durationTagId(platformId, duration) {
  const p = getPlatform(platformId);
  const hit = p.durationTags.find((b) => duration < b.max) || p.durationTags[p.durationTags.length - 1];
  return hit.id;
}

/**
 * 把数据源自带的类目（如 B站分区）翻译成内部标签提示。
 * @returns {{ topicHint: string|null, craftHint: string[] }}
 */
export function mapCategory(platformId, category) {
  const c = String(category || '').trim();
  if (!c) return { topicHint: null, craftHint: [] };
  if (platformId === 'bilibili') {
    return { topicHint: BILI_TOPIC_MAP[c] || null, craftHint: BILI_CRAFT_MAP[c] || [] };
  }
  return { topicHint: null, craftHint: [] };
}

export default PLATFORMS;
