/**
 * 等级曲线单一配置源已上移到跨端共享层 shared/core/level-config.ts
 * （主库与 android-app 共用，避免双份常量漂移）。此文件保留为兼容 re-export。
 */
export * from '../shared/core/level-config'
