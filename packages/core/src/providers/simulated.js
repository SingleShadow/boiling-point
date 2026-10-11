/**
 * 仿真数据引擎
 * 内置 40+ 条真实感视频池，按日期种子扰动指标，保证：
 *   - 同一天多次查询结果一致（可复现）
 *   - 跨天自然变化（真正的「每日榜单」）
 */
import { createSeededRng } from '../utils/seededRandom.js';
import { toDateKey } from '../utils/date.js';

const POOL = [
  { topic: 'topic_drama', title: '相亲对象竟然是我上司，当场社死到脚趾抠地', author: '戏精小剧场', fans: 128, dur: 47, play: 1860, er: 0.082, craft: ['form_acting', 'hook_conflict', 'tech_transition'], challenges: ['剧情反转', '社死现场'] },
  { topic: 'topic_drama', title: '婆婆偷偷把我的嫁妆拿去给小叔子买房，我这样做', author: '家长里短剧', fans: 342, dur: 62, play: 2240, er: 0.091, craft: ['form_acting', 'hook_conflict', 'interact_controversy'], challenges: ['婆媳关系', '家庭伦理'] },
  { topic: 'topic_comedy', title: '当代打工人的早八现状，最后一条太真实了', author: '打工人阿伟', fans: 210, dur: 28, play: 1580, er: 0.104, craft: ['form_acting', 'hook_promise', 'tech_subtitle'], challenges: ['打工人日常', '早八'] },
  { topic: 'topic_comedy', title: '当我用 AI 帮我相亲，对面直接笑到打鸣', author: '整活研究所', fans: 96, dur: 34, play: 1320, er: 0.118, craft: ['form_acting', 'hook_reverse', 'interact_vote'], challenges: ['AI整活', '搞笑'] },
  { topic: 'topic_knowledge', title: '为什么高铁不用安全带？三个冷知识一次讲清', author: '硬核科普君', fans: 512, dur: 55, play: 940, er: 0.061, craft: ['form_talking', 'hook_question', 'copy_number'], challenges: ['涨知识', '冷知识'] },
  { topic: 'topic_knowledge', title: '一分钟看懂今年医保新规，家里有老人的一定要看', author: '政策速递', fans: 288, dur: 58, play: 1120, er: 0.073, craft: ['form_talking', 'hook_promise', 'cta_collect'], challenges: ['医保新政', '民生'] },
  { topic: 'topic_food', title: '5 块钱做出米其林摆盘的早餐，老婆以为我发财了', author: '厨房老王', fans: 176, dur: 39, play: 1460, er: 0.087, craft: ['form_vlog', 'tech_contrast', 'hook_reverse'], challenges: ['早餐灵感', '低成本美食'] },
  { topic: 'topic_food', title: '成都苍蝇馆子到底有多野？本地人带路实测 8 家', author: '老饕探店', fans: 421, dur: 72, play: 1680, er: 0.079, craft: ['form_vlog', 'form_pov', 'copy_number'], challenges: ['成都美食', '苍蝇馆子'] },
  { topic: 'topic_travel', title: '人均 800 玩转泉州 3 天，我把路线全画好了', author: '在路上的阿May', fans: 156, dur: 64, play: 890, er: 0.068, craft: ['form_vlog', 'copy_number', 'cta_collect'], challenges: ['泉州旅游', '穷游攻略'] },
  { topic: 'topic_travel', title: '凌晨 4 点的黄山，看到日出那一刻我破防了', author: '徒步小陈', fans: 88, dur: 41, play: 1180, er: 0.096, craft: ['form_pov', 'hook_emotion', 'elem_bgm'], challenges: ['黄山日出', '徒步'] },
  { topic: 'topic_emotion', title: '35 岁被裁员后，我在便利店上了三个月夜班', author: '深夜树洞', fans: 264, dur: 78, play: 2020, er: 0.112, craft: ['form_talking', 'hook_emotion', 'copy_firstperson'], challenges: ['成年人崩溃', '职场故事'] },
  { topic: 'topic_emotion', title: '奶奶把攒了 20 年的铁盒打开，里面是……', author: '家的记忆', fans: 398, dur: 52, play: 2680, er: 0.128, craft: ['form_vlog', 'hook_suspense', 'emo_positive'], challenges: ['亲情', '泪目'] },
  { topic: 'topic_beauty', title: '素颜到妆后差多少？同事没认出我来', author: '阿宁的化妆台', fans: 302, dur: 23, play: 1740, er: 0.093, craft: ['tech_transition', 'tech_contrast', 'hook_question'], challenges: ['妆前妆后', '变装'] },
  { topic: 'topic_beauty', title: '150cm 这样穿直接显高 10cm，短腿星人必看', author: '小个子穿搭', fans: 187, dur: 31, play: 1290, er: 0.085, craft: ['form_beat', 'copy_number', 'cta_collect'], challenges: ['小个子穿搭', '显高'] },
  { topic: 'topic_tech', title: '2000 元档手机横评：这 3 款闭眼买不亏', author: '数码老炮', fans: 468, dur: 86, play: 760, er: 0.058, craft: ['form_talking', 'copy_number', 'tech_split'], challenges: ['手机测评', '数码'] },
  { topic: 'topic_tech', title: '用 AI 十分钟做完一周的 PPT，老板以为我加班了', author: '效率实验室', fans: 233, dur: 44, play: 1380, er: 0.081, craft: ['form_talking', 'hook_promise', 'copy_number'], challenges: ['AI工具', '效率'] },
  { topic: 'topic_pet', title: '布偶猫第一次见到雪，反应把我笑晕了', author: '两只猫的铲屎官', fans: 356, dur: 19, play: 3120, er: 0.134, craft: ['form_pov', 'hook_scene', 'elem_bgm'], challenges: ['猫咪日常', '萌宠'] },
  { topic: 'topic_pet', title: '金毛自己开门去邻居家蹭饭，监控全拍下来了', author: '修勾日记', fans: 289, dur: 26, play: 2460, er: 0.121, craft: ['form_cctv', 'hook_conflict', 'interact_easter'], challenges: ['狗狗成精', '监控下的真相'] },
  { topic: 'topic_parenting', title: '辅导作业第 8 天，我终于理解了什么叫修行', author: '陪读妈妈', fans: 142, dur: 37, play: 1640, er: 0.107, craft: ['form_acting', 'hook_emotion', 'copy_firstperson'], challenges: ['辅导作业', '亲子'] },
  { topic: 'topic_parenting', title: '4 岁娃自己做了顿饭，最后一步我眼泪下来了', author: '带娃日常', fans: 512, dur: 49, play: 2180, er: 0.115, craft: ['form_vlog', 'hook_emotion', 'emo_positive'], challenges: ['萌娃', '亲子时光'] },
  { topic: 'topic_fitness', title: '每天 8 分钟，一个月腰围少了 7cm（附完整跟练）', author: '教练阿凯', fans: 398, dur: 66, play: 1040, er: 0.072, craft: ['form_talking', 'copy_number', 'cta_collect'], challenges: ['减肥打卡', '居家健身'] },
  { topic: 'topic_fitness', title: '我把奶茶换成它，30 天身体发生了什么', author: '营养师小林', fans: 176, dur: 43, play: 1120, er: 0.076, craft: ['form_vlog', 'tech_contrast', 'hook_question'], challenges: ['健康饮食', '30天挑战'] },
  { topic: 'topic_career', title: '领导说"你看着办"到底什么意思？十年老员工拆解', author: '职场老炮儿', fans: 421, dur: 58, play: 1380, er: 0.089, craft: ['form_talking', 'hook_question', 'interact_controversy'], challenges: ['职场生存', '沟通'] },
  { topic: 'topic_career', title: '裸辞三个月后，我把真心话全说了', author: '前大厂员工', fans: 154, dur: 71, play: 1720, er: 0.103, craft: ['form_talking', 'hook_emotion', 'copy_firstperson'], challenges: ['裸辞', '职业选择'] },
  { topic: 'topic_guofeng', title: '穿马面裙去上班，外国同事问我是不是要去演出', author: '阿枝国风', fans: 268, dur: 38, play: 1420, er: 0.094, craft: ['form_vlog', 'hook_conflict', 'elem_filter'], challenges: ['马面裙', '国风'] },
  { topic: 'topic_guofeng', title: '复原宋代点茶，第一口我愣住了', author: '非遗手作', fans: 98, dur: 54, play: 860, er: 0.069, craft: ['form_vlog', 'hook_reverse', 'form_asmr'], challenges: ['非遗', '点茶'] },
  { topic: 'topic_auto', title: '提车三个月，这 5 个配置我劝你别加钱', author: '车主说车', fans: 312, dur: 62, play: 780, er: 0.063, craft: ['form_talking', 'copy_number', 'hook_promise'], challenges: ['买车攻略', '新能源'] },
  { topic: 'topic_auto', title: '自动泊车翻车合集，最后一个笑不活了', author: '车库观察员', fans: 187, dur: 33, play: 1560, er: 0.112, craft: ['form_slideshow', 'hook_promise', 'tech_subtitle'], challenges: ['自动泊车', '搞笑'] },
  { topic: 'topic_game', title: '新版本上分最强阵容，胜率直接拉到 78%', author: '峡谷教练', fans: 356, dur: 47, play: 690, er: 0.055, craft: ['form_talking', 'copy_number', 'tech_split'], challenges: ['游戏攻略', '上分'] },
  { topic: 'topic_game', title: '开黑遇到神队友，这操作我看了十遍', author: '游戏高光', fans: 264, dur: 29, play: 1180, er: 0.098, craft: ['form_slideshow', 'hook_reverse', 'tech_slowmo'], challenges: ['游戏高光', '开黑'] },
  { topic: 'topic_rural', title: '回村种地第 100 天，城里朋友说我变黑了但眼睛亮了', author: '回村的小李', fans: 132, dur: 68, play: 1280, er: 0.086, craft: ['form_vlog', 'hook_emotion', 'copy_firstperson'], challenges: ['回村', '乡村生活'] },
  { topic: 'topic_rural', title: '爷爷的老手艺，一天只能做 3 个', author: '乡下手艺人', fans: 76, dur: 57, play: 940, er: 0.078, craft: ['form_vlog', 'copy_number', 'form_asmr'], challenges: ['手艺人', '传统工艺'] },
  { topic: 'topic_shop', title: '人均 30 的宝藏小馆，本地人排了 20 年队', author: '城市觅食', fans: 208, dur: 45, play: 1090, er: 0.081, craft: ['form_pov', 'copy_number', 'hook_promise'], challenges: ['探店', '宝藏小店'] },
  { topic: 'topic_shop', title: '网红店 vs 老字号，盲测结果有点意外', author: '吃货测评组', fans: 289, dur: 52, play: 1340, er: 0.092, craft: ['tech_split', 'interact_vote', 'hook_question'], challenges: ['盲测', '网红店'] },
  { topic: 'topic_fashion', title: '通勤穿搭一周不重样，同事问我是不是涨工资了', author: '通勤衣橱', fans: 176, dur: 36, play: 980, er: 0.074, craft: ['form_beat', 'copy_number', 'tech_transition'], challenges: ['通勤穿搭', 'OOTD'] },
  { topic: 'topic_knowledge', title: '为什么超市货架最贵的都在视线平行位置？', author: '商业观察', fans: 342, dur: 49, play: 1020, er: 0.067, craft: ['form_talking', 'hook_question', 'tech_subtitle'], challenges: ['商业冷知识', '涨知识'] },
  { topic: 'topic_emotion', title: '地铁上看到这一幕，我偷偷拍了下来', author: '城市观察者', fans: 456, dur: 24, play: 2860, er: 0.131, craft: ['form_cctv', 'hook_scene', 'emo_positive'], challenges: ['温暖瞬间', '人间烟火'] },
  { topic: 'topic_comedy', title: '当东北人第一次去广东早茶，服务员都懵了', author: '南北差异研究', fans: 233, dur: 42, play: 1890, er: 0.109, craft: ['form_acting', 'hook_conflict', 'interact_controversy'], challenges: ['南北差异', '搞笑'] },
  { topic: 'topic_tech', title: '我把十年前的旧电脑装上新系统，性能居然翻倍', author: '折腾电子', fans: 143, dur: 74, play: 720, er: 0.059, craft: ['form_vlog', 'tech_contrast', 'hook_reverse'], challenges: ['旧物改造', '数码'] },
  { topic: 'topic_pet', title: '猫和狗第一次见面，第三秒我笑到打鸣', author: '毛孩子日常', fans: 402, dur: 21, play: 2940, er: 0.126, craft: ['form_pov', 'hook_scene', 'elem_bgm'], challenges: ['猫狗双全', '萌宠'] },
  { topic: 'topic_food', title: '不用烤箱的懒人蛋糕，新手零失败', author: '懒人厨房', fans: 264, dur: 33, play: 1230, er: 0.083, craft: ['form_vlog', 'hook_promise', 'cta_collect'], challenges: ['懒人食谱', '烘焙'] },
  { topic: 'topic_guofeng', title: '把《千里江山图》穿在身上，走在街上被围观了', author: '国风造物', fans: 198, dur: 29, play: 1680, er: 0.101, craft: ['tech_transition', 'elem_filter', 'hook_scene'], challenges: ['国潮', '汉服'] },
];

const MUSIC = ['《悬溺》', '《若梦》', '《大展宏图》', '《可能》', '《奢香夫人》', '《科目三》', '《枕着光的她》', '《春娇与志明》', '《起风了》', '《一路生花》'];
const MUSIC_AUTHORS = ['平台热歌榜', '原创音乐人', '影视原声', '热门BGM'];

/**
 * 抓取当日 Top N 爆款
 * @param {{dateKey?:string, limit?:number, metric?:'play'|'engage'}} opts
 */
export async function fetchTopVideos(opts = {}) {
  const dateKey = opts.dateKey || toDateKey();
  const limit = opts.limit || 10;
  const metric = opts.metric || 'play';
  const rng = createSeededRng(`boiling:${dateKey}:${metric}`);

  // 每日题材浪潮：随机 3 个题材获得流量加成，使「每日趋势」真正逐日变化
  const topicKeys = [...new Set(POOL.map((p) => p.topic))];
  const waveRng = createSeededRng(`boiling:wave:${dateKey}`);
  const hot = waveRng.sample(topicKeys, 3);
  const wave = new Map(hot.map((t, i) => [t, [1.85, 1.45, 1.2][i]]));

  const items = POOL.map((p, i) => {
    // 指标扰动：基础 ±35% 噪声 + 当日题材加成
    const boost = wave.get(p.topic) || 1;
    const play = Math.round(p.play * 10000 * rng.float(0.65, 1.35) * boost);
    const er = Math.max(0.02, p.er * rng.float(0.85, 1.2));
    const digg = Math.round(play * er * rng.float(0.62, 0.78));
    const comment = Math.round(digg * rng.float(0.09, 0.18));
    const share = Math.round(digg * rng.float(0.08, 0.2));
    const collect = Math.round(digg * rng.float(0.15, 0.34));
    const fans = Math.round(p.fans * 10000 * rng.float(0.9, 1.15));
    const dur = Math.max(8, Math.round(p.dur * rng.float(0.88, 1.14)));
    const createTime = new Date(`${dateKey}T00:00:00`);
    createTime.setHours(rng.int(7, 23), rng.int(0, 59), 0, 0);

    return {
      id: `sim_${dateKey.replace(/-/g, '')}_${String(i + 1).padStart(2, '0')}`,
      title: p.title,
      author: { id: `au_${i}`, nickname: p.author, fans },
      stats: { play, digg, comment, share, collect },
      duration: dur,
      createTime: createTime.toISOString(),
      cover: '',
      url: `https://www.douyin.com/video/${i + 1}`,
      music: { title: rng.pick(MUSIC), author: rng.pick(MUSIC_AUTHORS) },
      challenges: p.challenges,
      source: 'simulated',
      raw: { poolIndex: i, topicHint: p.topic, craftHint: p.craft },
    };
  });

  const engageScore = (v) => (v.stats.digg + v.stats.comment * 3 + v.stats.share * 4 + v.stats.collect * 2);
  items.sort((a, b) =>
    metric === 'engage' ? engageScore(b) - engageScore(a) : b.stats.play - a.stats.play
  );

  return {
    videos: items.slice(0, limit),
    source: 'simulated',
    dateKey,
    metric,
    trendWave: hot,
    warnings: [],
  };
}

export const name = 'simulated';
export const poolSize = POOL.length;
