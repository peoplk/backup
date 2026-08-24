import nextConfig from 'eslint-config-next'

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  ...nextConfig,
  {
    ignores: [
      '**/.next/**',
      '**/node_modules/**',
      'android/**',
      'android-app/**',
      'electron/**',
      'dist/**',
      'out/**',
      'server/**',
    ],
  },
  {
    rules: {
      // react-hooks 实验性严格规则：仓库中存在大量历史代码不符合，先降级为警告便于逐步重构
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/set-state-in-render': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      // React 显示名规则：匿名 memo 组件较多，先降级为警告
      'react/display-name': 'warn',
      // React JSX 中引号无需强制转义
      'react/no-unescaped-entities': 'warn',
      // Next.js App Router 下自定义字体加载方式不同，该规则不适用
      '@next/next/no-page-custom-font': 'off',
    },
  },
]

export default eslintConfig
