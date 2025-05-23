<script setup lang="ts">
import { computed, VNode, h } from 'vue';
import type { CSSProperties } from 'vue';

type Style = Record<'avatar' | 'content', CSSProperties>;

interface BubbleProps {
  avatar?: string;
  content: string;
  loading?: boolean;
  placement?: 'start' | 'end';
  shape?: 'round' | 'corner';
  styles?: Partial<Style>;
  contentRender?: (content: string) => VNode;
}

const props = withDefaults(defineProps<BubbleProps>(), {
  loading: false,
  placement: 'start',
  shape: 'corner',
});
</script>

<template>
  <div class="bubble-wrapper">
    <div
      class="bubble-wrapper-avatar"
      v-if="avatar"
      :style="styles ? styles['avatar'] : ''"
    >
      <img :src="avatar" alt="" />
    </div>
    <div
      class="bubble-wrapper-content"
      :style="styles ? styles['content'] : ''"
    >
      <div class="loading" v-if="loading">
        <img src="@/assets/images/loading.png" alt="" class="loading-icon" />
        <div class="loading-text">EulerCopilot正在生成回答...</div>
      </div>
      <template v-else>
        <component v-if="contentRender" :is="contentRender(content)" />
        <div v-else>
          {{ content }}
        </div>
      </template>

      <slot name="footer" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.bubble-wrapper {
  width: 100%;
  display: flex;
  justify-content: flex-start;

  &-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    margin-right: 12px;
    flex-shrink: 0;
    img {
      width: 100%;
      height: 100%;
      border-radius: 50%;
    }
  }

  &-content {
    background-color: var(--o-bg-color-base);
    color: var(--o-text-color-primary);
    padding: 14px;
    border-radius: 8px;
    border-top-left-radius: 0px;
    word-break: break-all;

    .loading {
      display: flex;
      background-color: var(--o-bg-color-base);
      border-radius: 8px;
      border-top-left-radius: 0px;

      @keyframes rotate-img {
        from {
          transform: rotate(0);
        }

        to {
          transform: rotate(360deg);
        }
      }

      &-icon {
        animation: rotate-img 1s infinite linear;
      }

      &-text {
        font-size: 16px;
        padding-left: 12px;
        color: var(--o-text-color-primary);
      }
    }
  }
}
</style>
