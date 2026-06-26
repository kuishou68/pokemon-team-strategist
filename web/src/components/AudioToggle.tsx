import { useAudio } from '../hooks/useAudio';

export function AudioToggle() {
  const { enabled, available, toggle } = useAudio();
  return (
    <button
      onClick={toggle}
      className="gb-card px-2 py-1 text-xs flex items-center gap-1"
      title={
        available
          ? enabled
            ? '关闭背景音乐'
            : '开启背景音乐'
          : '未找到音频文件（见 README，自行放置 CC0 音源）'
      }
      aria-label="背景音乐开关"
    >
      <span>{enabled ? '🔊' : '🔈'}</span>
      <span className="hidden sm:inline">{enabled ? 'BGM 开' : 'BGM 关'}</span>
    </button>
  );
}
