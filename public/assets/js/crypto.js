/*
 * crypto.js — 纯前端加密实现，等价于原 PHP 版 Encryptor.php
 *
 * 加密流程（与 PHP 一致）：
 *   1. 密钥 = md5("tommy") 的小写十六进制串，取前 16 个字符（即 16 字节 ASCII）作为 AES-128 密钥
 *   2. 明文以 \0 零填充到 16 字节整数倍
 *   3. AES-128-ECB（无填充，使用上面手动的零填充）
 *   4. 密文原始字节做 Base64，即为 config.bin 内容
 *
 * 该文件同时兼容浏览器（挂到 window.AirCrypto）与 Node（module.exports），便于自动化校验。
 */
(function (global) {
  'use strict';

  // ---- AES-128 S-Box（由定义程序化生成，避免手抄错误）----
  function gfMul(a, b) {
    let r = 0;
    for (let i = 0; i < 8; i++) {
      if (b & 1) r ^= a;
      const hi = a & 0x80;
      a = (a << 1) & 0xff;
      if (hi) a ^= 0x1b;
      b >>= 1;
    }
    return r & 0xff;
  }
  function gfInv(a) {
    if (a === 0) return 0;
    for (let b = 1; b < 256; b++) {
      if (gfMul(a, b) === 1) return b;
    }
    return 0;
  }
  const SBOX = (function () {
    const s = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      const inv = gfInv(i);
      let res = 0;
      for (let j = 0; j < 8; j++) {
        const bit =
          ((inv >> j) & 1) ^
          ((inv >> ((j + 4) % 8)) & 1) ^
          ((inv >> ((j + 5) % 8)) & 1) ^
          ((inv >> ((j + 6) % 8)) & 1) ^
          ((inv >> ((j + 7) % 8)) & 1) ^
          ((0x63 >> j) & 1);
        res |= bit << j;
      }
      s[i] = res;
    }
    return s;
  })();

  // GF(2^8) 乘 2
  function xtime(a) {
    return ((a << 1) ^ ((a & 0x80) ? 0x1b : 0)) & 0xff;
  }
  // GF(2^8) 乘 x
  function gmul(a, b) {
    let r = 0;
    for (let i = 0; i < 8; i++) {
      if (b & 1) r ^= a;
      const hi = a & 0x80;
      a = (a << 1) & 0xff;
      if (hi) a ^= 0x1b;
      b >>= 1;
    }
    return r & 0xff;
  }

  // 密钥扩展（AES-128：Nk=4, Nr=10）
  function keyExpansion(key) {
    const Nk = 4, Nr = 10;
    const w = new Uint8Array(4 * (Nr + 1) * 4);
    for (let i = 0; i < 16; i++) w[i] = key[i];
    const Rcon = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];
    for (let i = Nk; i < (Nr + 1) * Nk; i++) {
      // temp = 前一个字 W[i-1]，存储在 w[4*(i-1) .. 4*(i-1)+3]
      let t0 = w[4 * i - 4], t1 = w[4 * i - 3], t2 = w[4 * i - 2], t3 = w[4 * i - 1];
      if (i % Nk === 0) {
        // RotWord
        const a = t0, b = t1, c = t2, d = t3;
        t0 = b; t1 = c; t2 = d; t3 = a;
        // SubWord
        t0 = SBOX[t0]; t1 = SBOX[t1]; t2 = SBOX[t2]; t3 = SBOX[t3];
        t0 ^= Rcon[(i / Nk) - 1];
      }
      const p = (i - Nk) * 4;
      w[4 * i + 0] = w[p + 0] ^ t0;
      w[4 * i + 1] = w[p + 1] ^ t1;
      w[4 * i + 2] = w[p + 2] ^ t2;
      w[4 * i + 3] = w[p + 3] ^ t3;
    }
    return w;
  }

  function addRoundKey(state, w, round) {
    const base = round * 16;
    for (let i = 0; i < 16; i++) state[i] ^= w[base + i];
  }
  function subBytes(state) {
    for (let i = 0; i < 16; i++) state[i] = SBOX[state[i]];
  }
  function shiftRows(state) {
    // 列主序：index = r + 4*c
    const s = state.slice();
    for (let c = 0; c < 4; c++) {
      state[0 + 4 * c] = s[0 + 4 * c];
      state[1 + 4 * c] = s[1 + 4 * ((c + 1) % 4)];
      state[2 + 4 * c] = s[2 + 4 * ((c + 2) % 4)];
      state[3 + 4 * c] = s[3 + 4 * ((c + 3) % 4)];
    }
  }
  function mixColumns(state) {
    for (let c = 0; c < 4; c++) {
      const i = 4 * c;
      const a0 = state[i], a1 = state[i + 1], a2 = state[i + 2], a3 = state[i + 3];
      state[i]     = xtime(a0) ^ (xtime(a1) ^ a1) ^ a2 ^ a3;
      state[i + 1] = a0 ^ xtime(a1) ^ (xtime(a2) ^ a2) ^ a3;
      state[i + 2] = a0 ^ a1 ^ xtime(a2) ^ (xtime(a3) ^ a3);
      state[i + 3] = (xtime(a0) ^ a0) ^ a1 ^ a2 ^ xtime(a3);
    }
  }

  // 加密单个 16 字节块
  function encryptBlock(block, w) {
    const state = Uint8Array.from(block);
    const Nr = 10;
    addRoundKey(state, w, 0);
    for (let round = 1; round < Nr; round++) {
      subBytes(state);
      shiftRows(state);
      mixColumns(state);
      addRoundKey(state, w, round);
    }
    subBytes(state);
    shiftRows(state);
    addRoundKey(state, w, Nr);
    return state;
  }

  /**
   * AES-128-ECB 加密（调用方需保证明文长度为 16 的整数倍）
   * @param {Uint8Array} plain 长度必须是 16 的倍数
   * @param {Uint8Array} key 16 字节
   * @returns {Uint8Array} 密文
   */
  function aes128EcbEncrypt(plain, key) {
    if (key.length !== 16) throw new Error('AES-128 密钥必须是 16 字节');
    if (plain.length % 16 !== 0) throw new Error('明文长度必须是 16 的整数倍');
    const w = keyExpansion(key);
    const out = new Uint8Array(plain.length);
    for (let off = 0; off < plain.length; off += 16) {
      const block = plain.subarray(off, off + 16);
      const enc = encryptBlock(block, w);
      out.set(enc, off);
    }
    return out;
  }

  // ---- MD5（标准实现，输入字符串以 UTF-8 编码）----
  function md5(input) {
    const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;

    function add32(a, b) { return (a + b) & 0xffffffff; }
    function cmn(q, a, b, x, s, t) {
      a = add32(add32(a, q), add32(x, t));
      a = ((a << s) | (a >>> (32 - s))) >>> 0;
      return add32(a, b);
    }
    function ff(a, b, c, d, x, s, t) { return cmn((b & c) | (~b & d), a, b, x, s, t); }
    function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & ~d), a, b, x, s, t); }
    function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
    function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | ~d), a, b, x, s, t); }

    const len = bytes.length;
    const newLen = (((len + 8) >> 6) + 1) * 64;
    const words = new Uint32Array(newLen >> 2);
    for (let i = 0; i < len; i++) {
      words[i >> 2] |= bytes[i] << ((i % 4) * 8);
    }
    words[len >> 2] |= 0x80 << ((len % 4) * 8);
    words[((newLen >> 2) - 2)] = len * 8;

    let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;

    for (let i = 0; i < newLen; i += 64) {
      const oa = a, ob = b, oc = c, od = d;
      const X = words.subarray(i >> 2, (i >> 2) + 16);
      // 第一轮
      a = ff(a, b, c, d, X[0], 7, -680876936);
      d = ff(d, a, b, c, X[1], 12, -389564586);
      c = ff(c, d, a, b, X[2], 17, 606105819);
      b = ff(b, c, d, a, X[3], 22, -1044525330);
      a = ff(a, b, c, d, X[4], 7, -176418897);
      d = ff(d, a, b, c, X[5], 12, 1200080426);
      c = ff(c, d, a, b, X[6], 17, -1473231341);
      b = ff(b, c, d, a, X[7], 22, -45705983);
      a = ff(a, b, c, d, X[8], 7, 1770035416);
      d = ff(d, a, b, c, X[9], 12, -1958414417);
      c = ff(c, d, a, b, X[10], 17, -42063);
      b = ff(b, c, d, a, X[11], 22, -1990404162);
      a = ff(a, b, c, d, X[12], 7, 1804603682);
      d = ff(d, a, b, c, X[13], 12, -40341101);
      c = ff(c, d, a, b, X[14], 17, -1502002290);
      b = ff(b, c, d, a, X[15], 22, 1236535329);
      // 第二轮
      a = gg(a, b, c, d, X[1], 5, -165796510);
      d = gg(d, a, b, c, X[6], 9, -1069501632);
      c = gg(c, d, a, b, X[11], 14, 643717713);
      b = gg(b, c, d, a, X[0], 20, -373897302);
      a = gg(a, b, c, d, X[5], 5, -701558691);
      d = gg(d, a, b, c, X[10], 9, 38016083);
      c = gg(c, d, a, b, X[15], 14, -660478335);
      b = gg(b, c, d, a, X[4], 20, -405537848);
      a = gg(a, b, c, d, X[9], 5, 568446438);
      d = gg(d, a, b, c, X[14], 9, -1019803690);
      c = gg(c, d, a, b, X[3], 14, -187363961);
      b = gg(b, c, d, a, X[8], 20, 1163531501);
      a = gg(a, b, c, d, X[13], 5, -1444681467);
      d = gg(d, a, b, c, X[2], 9, -51403784);
      c = gg(c, d, a, b, X[7], 14, 1735328473);
      b = gg(b, c, d, a, X[12], 20, -1926607734);
      // 第三轮
      a = hh(a, b, c, d, X[5], 4, -378558);
      d = hh(d, a, b, c, X[8], 11, -2022574463);
      c = hh(c, d, a, b, X[11], 16, 1839030562);
      b = hh(b, c, d, a, X[14], 23, -35309556);
      a = hh(a, b, c, d, X[1], 4, -1530992060);
      d = hh(d, a, b, c, X[4], 11, 1272893353);
      c = hh(c, d, a, b, X[7], 16, -155497632);
      b = hh(b, c, d, a, X[10], 23, -1094730640);
      a = hh(a, b, c, d, X[13], 4, 681279174);
      d = hh(d, a, b, c, X[0], 11, -358537222);
      c = hh(c, d, a, b, X[3], 16, -722521979);
      b = hh(b, c, d, a, X[6], 23, 76029189);
      a = hh(a, b, c, d, X[9], 4, -640364487);
      d = hh(d, a, b, c, X[12], 11, -421815835);
      c = hh(c, d, a, b, X[15], 16, 530742520);
      b = hh(b, c, d, a, X[2], 23, -995338651);
      // 第四轮
      a = ii(a, b, c, d, X[0], 6, -198630844);
      d = ii(d, a, b, c, X[7], 10, 1126891415);
      c = ii(c, d, a, b, X[14], 15, -1416354905);
      b = ii(b, c, d, a, X[5], 21, -57434055);
      a = ii(a, b, c, d, X[12], 6, 1700485571);
      d = ii(d, a, b, c, X[3], 10, -1894986606);
      c = ii(c, d, a, b, X[10], 15, -1051523);
      b = ii(b, c, d, a, X[1], 21, -2054922799);
      a = ii(a, b, c, d, X[8], 6, 1873313359);
      d = ii(d, a, b, c, X[15], 10, -30611744);
      c = ii(c, d, a, b, X[6], 15, -1560198380);
      b = ii(b, c, d, a, X[13], 21, 1309151649);
      a = ii(a, b, c, d, X[4], 6, -145523070);
      d = ii(d, a, b, c, X[11], 10, -1120210379);
      c = ii(c, d, a, b, X[2], 15, 718787259);
      b = ii(b, c, d, a, X[9], 21, -343485551);

      a = add32(a, oa);
      b = add32(b, ob);
      c = add32(c, oc);
      d = add32(d, od);
    }

    function toHex(v) {
      let s = '';
      for (let i = 0; i < 4; i++) {
        const x = (v >>> (i * 8)) & 0xff;
        s += x.toString(16).padStart(2, '0');
      }
      return s;
    }
    return toHex(a) + toHex(b) + toHex(c) + toHex(d);
  }

  // ---- Base64 ----
  function bytesToBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function stringToUtf8Bytes(str) {
    return new TextEncoder().encode(str);
  }

  /**
   * 等价 Encryptor::encryptToBase64：对 Lua 明文加密并输出 Base64 字符串
   * @param {string} plainText
   * @returns {string} Base64
   */
  function encryptConfig(plainText) {
    const ENCRYPT_KEY = 'tommy';
    const md5hex = md5(ENCRYPT_KEY);              // 32 字符小写十六进制
    const aesKeyStr = md5hex.slice(0, 16);        // 取前 16 个字符 → 16 字节 ASCII 密钥
    const keyBytes = stringToUtf8Bytes(aesKeyStr);

    let plain = stringToUtf8Bytes(plainText);
    // 零填充到 16 字节整数倍
    const pad = 16 - (plain.length % 16);
    if (pad < 16) {
      const padded = new Uint8Array(plain.length + pad);
      padded.set(plain);
      // 剩余字节默认就是 0
      plain = padded;
    }
    const cipher = aes128EcbEncrypt(plain, keyBytes);
    return bytesToBase64(cipher);
  }

  const API = {
    md5,
    aes128EcbEncrypt,
    bytesToBase64,
    encryptConfig,
    _internal: { SBOX, keyExpansion, encryptBlock, md5 }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  } else {
    global.AirCrypto = API;
  }
})(typeof window !== 'undefined' ? window : globalThis);
