// 测试环境：提供 dummy key，使 llm.ts 模块加载不报错（真实调用已被 mock 桩替换）
process.env.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || 'sk-test-dummy';
process.env.OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'stub-model';
