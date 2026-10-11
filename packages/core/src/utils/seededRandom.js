/**
 * 确定性伪随机：同一日期种子 => 同一份「当日榜单」
 * 保证演示可复现，同时日更自然变化。
 */

/** 字符串 -> 32 位整数哈希 (FNV-1a) */
export function hashSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 —— 小巧、稳定、分布够用 */
export function createRng(seed) {
  let a = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 常用派生方法 */
export function rngHelpers(rng) {
  return {
    next: rng,
    int: (min, max) => Math.floor(rng() * (max - min + 1)) + min,
    float: (min, max) => rng() * (max - min) + min,
    pick: (arr) => arr[Math.floor(rng() * arr.length)],
    /** 不重复抽样 */
    sample: (arr, n) => {
      const pool = arr.slice();
      const out = [];
      while (pool.length && out.length < n) {
        out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
      }
      return out;
    },
    /** 中文人名/词组的加权选择 */
    weighted: (items, weightFn) => {
      const total = items.reduce((s, it) => s + Math.max(0, weightFn(it)), 0);
      if (total <= 0) return items[0];
      let r = rng() * total;
      for (const it of items) {
        r -= Math.max(0, weightFn(it));
        if (r <= 0) return it;
      }
      return items[items.length - 1];
    },
  };
}

export function createSeededRng(seed) {
  return rngHelpers(createRng(seed));
}
