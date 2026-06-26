// ============================================================
// BGM：hotlink 免授权 8-bit 游戏音乐（CC-BY，无需打包进仓库）
// 曲目：「8bit Dungeon Level」 by Kevin MacLeod (incompetech.com) — CC-BY 3.0
// 默认静音；用户点喇叭开启（用户手势内 play，符合自动播放策略）。
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';

const PREF_KEY = 'pts_audio_on';
// 免授权游戏风 BGM 直链（CC-BY，README 已署名）。如本地网络访问慢，可改走后端代理。
const BGM_SRC =
  'https://incompetech.com/music/royalty-free/mp3-royaltyfree/8bit%20Dungeon%20Level.mp3';

export interface UseAudio {
  enabled: boolean;
  available: boolean;
  toggle: () => void;
}

export function useAudio(): UseAudio {
  const [enabled, setEnabled] = useState<boolean>(() => localStorage.getItem(PREF_KEY) === '1');
  const [available, setAvailable] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(BGM_SRC);
    audio.loop = true;
    audio.volume = 0.4;
    audio.preload = 'none';
    audio.addEventListener('error', () => setAvailable(false));
    audioRef.current = audio;
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (enabled) {
      audio.play().catch(() => setAvailable(false)); // 被拦/网络失败 → 标记不可用
    } else {
      audio.pause();
    }
    localStorage.setItem(PREF_KEY, enabled ? '1' : '0');
  }, [enabled]);

  const toggle = useCallback(() => setEnabled((e) => !e), []);

  return { enabled, available, toggle };
}
