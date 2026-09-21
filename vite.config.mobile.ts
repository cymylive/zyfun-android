/**
 * zyfun mobile 构建配置 —— 只构建 renderer（Vue3），产出纯静态资源
 * 通过 alias 把 @/ 和 @shared/ 指向原 renderer 代码，@mobile/ 指向移动端实现。
 */
import { resolve } from 'node:path';

import { TDesignResolver } from '@tdesign-vue-next/auto-import-resolver';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { defineConfig } from 'vite';
import viteSvgLoader from 'vite-svg-loader';

export default defineConfig({
  root: resolve(__dirname, 'src/mobile'),
  base: './',
  publicDir: false,
  plugins: [
    vue({
      template: { compilerOptions: { isCustomElement: (tag) => ['webview'].includes(tag) } },
    }),
    vueJsx(),
    AutoImport({
      resolvers: [TDesignResolver({ library: 'vue-next' }), TDesignResolver({ library: 'chat' })],
    }),
    Components({
      resolvers: [TDesignResolver({ library: 'vue-next' }), TDesignResolver({ library: 'chat' })],
    }),
    viteSvgLoader(),
  ],
  resolve: {
    alias: {
      // 移动端入口专用
      '@mobile': resolve(__dirname, 'src/mobile'),
      // electron 类型 stub（renderer 里 import type ... from 'electron'）
      electron: resolve(__dirname, 'src/mobile/shims/electron-types.ts'),
      // 复用桌面 renderer
      '@': resolve(__dirname, 'src/renderer/src'),
      '@renderer': resolve(__dirname, 'src/renderer'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@pkg': resolve(__dirname, 'package.json'),
    },
  },
  define: {
    // 移动端不依赖 Fastify，走本地路由
    'import.meta.env.VITE_API_URL': JSON.stringify(''),
    'import.meta.env.VITE_API_URL_PREFIX': JSON.stringify('/api'),
    'import.meta.env.VITE_API_PORT': JSON.stringify('0'),
    'import.meta.env.VITE_MAIN_BUNDLE_ID': JSON.stringify('com.github.zyfun.mobile'),
  },
  optimizeDeps: {
    include: ['monaco-yaml/yaml.worker.js'],
    esbuildOptions: { target: 'esnext' },
  },
  worker: { format: 'es' },
  build: {
    outDir: resolve(__dirname, 'dist-mobile'),
    emptyOutDir: true,
    target: 'esnext',
    rollupOptions: {
      input: resolve(__dirname, 'src/mobile/index.html'),
      external: [],
      output: {
        entryFileNames: 'assets/entry/[name]_[hash].js',
        chunkFileNames: 'assets/chunk/[name]_[hash].js',
        assetFileNames: 'assets/static/[ext]/[name]_[hash].[ext]',
      },
      onwarn: (warning, defaultHandler) => {
        if (['EVAL', 'COMMONJS_VARIABLE_IN_ESM', 'PLUGIN_TIMINGS', 'CIRCULAR_DEPENDENCY'].includes(warning.code!)) return;
        defaultHandler(warning);
      },
    },
  },
  esbuild: { legalComments: 'none' },
  css: {
    preprocessorOptions: {
      less: {
        modifyVars: {
          hack: `true; @import (reference) "${resolve('src/renderer/src/style/variables.less')}";`,
        },
        math: 'strict',
        javascriptEnabled: true,
      },
    },
  },
});
