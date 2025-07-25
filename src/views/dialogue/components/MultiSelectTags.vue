<script setup>
import { api } from 'src/apis';
import {
  IconCheckBold,
  IconXSolid,
  IconCaretRight,
} from '@computing/opendesign-icons';
import { ref, computed, onMounted, watch } from 'vue';
import { useHistorySessionStore, useChangeThemeStore } from 'src/store';
import { storeToRefs } from 'pinia';
import TextMoreTootip from '@/components/textMoreTootip/index.vue';
const themeStore = useChangeThemeStore();
const { currentSelectedSession } = storeToRefs(useHistorySessionStore());
const isModalOpen = ref(false);
const searchKey = ref('');
const activeNames = ref([]);
const emit = defineEmits(['updateValue']);
const isTagsOverflow = ref(false);
const popoverVisible = ref(false);
const filterKnowledgeList = computed(() => {
  // filter by searchKey
  if (!searchKey.value) return availableitems.value;
  else {
    return availableitems.value
      .map((item) => {
        const filterList = item.kb_list.filter(
          (kb) =>
            kb.kbName.includes(searchKey.value) ||
            kb.kbId.includes(searchKey.value),
        );
        return filterList.length > 0 ? { ...item, kb_list: filterList } : null;
      })
      .filter((item) => item !== null);
  }
});
// 可选标签列表
const availableitems = ref([]);

// 已选择的标签
const selectedTags = ref([]);

// 选择标签
const selectTag = (tag) => {
  if (!selectedTags.value.includes(tag)) {
    selectedTags.value.push(tag);
  } else {
    selectedTags.value.splice(selectedTags.value.indexOf(tag), 1);
  }
  // 触发父组件的updateValue事件
  emit(
    'updateValue',
    selectedTags.value.map((item) => item.kbId),
  );
};
onMounted(() => {
  handleKnowledgeList();
});

watch(
  currentSelectedSession,
  () => {
    selectedTags.value = [];
    handleKnowledgeList();
  },
  {
    deep: true,
  },
);

const handleKnowledgeList = async () => {
  const [_, res] = await api.getConvKnowledgeList({
    conversationId: currentSelectedSession.value,
    kbName: '',
  });
  if (!_ && res && res.code === 200) {
    availableitems.value = res.result.teamKbList;
    availableitems.value.forEach((item) => {
      item.kb_list.forEach((kb) => {
        if (kb.isUsed === true) {
          selectedTags.value.push(kb);
        }
      });
    });
    emit(
      'updateValue',
      selectedTags.value.map((item) => item.kbId),
    );
    activeNames.value = res.result.teamKbList.map((item) => item.teamName);
    popoverVisible.value = true;
    document.querySelectorAll('.item-description').forEach((el) => {
      if (isOverflow(el, 2)) {
        el.classList.add('text-overflow-ellipsis');
      }
    });
  }
};

// 移除标签
const removeTag = (index) => {
  selectedTags.value.splice(index, 1);
};

// 检查标签是否已被选中
const isSelected = (tag) => {
  return selectedTags.value.includes(tag);
};

const toggleModal = () => {
  isModalOpen.value = !isModalOpen.value;
};

// 待优化
const checkTagsOverflow = () => {
  const container = document.querySelector('.tags-container');
  if (!container) return;

  const tags = container.querySelectorAll('.tag');
  if (!tags.length) return;

  //重置所有标签的样式
  tags.forEach((tag) => {
    tag.style.maxWidth = 'none';
    tag.querySelector('.tag-text').style.maxWidth = '120px';
  });

  if (container.scrollWidth >= container.clientWidth && !isTagsOverflow.value) {
    console.log(container.scrollWidth, container.clientWidth);
    isTagsOverflow.value = true;
    let lastVisibleIndex = tags.length - 1;
    while (lastVisibleIndex >= 0) {
      const tagRect = tags[lastVisibleIndex].getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      if (tagRect.right <= containerRect.right) {
        break;
      }
      lastVisibleIndex--;
    }

    if (lastVisibleIndex >= 0) {
      const lastTag = tags[lastVisibleIndex];
      const tagText = lastTag.querySelector('.tag-text');

      // 计算可用空间
      const containerRight = container.getBoundingClientRect().right;
      const tagRight = lastTag.getBoundingClientRect().right;
      const deleteBtnWidth = 20; // 关闭按钮的预估宽度

      // 设置最大宽度
      const availableWidth =
        containerRight - lastTag.getBoundingClientRect().left - deleteBtnWidth;
      tagText.style.maxWidth = `${Math.max(0, availableWidth)}px`;
    }
  }
};
</script>

<template>
  <div class="multi-select-container">
    <div class="multi-select-box">
      <div class="select-content">
        <div class="label-text" @click="toggleModal">
          <img
            v-if="themeStore.theme === 'light'"
            class="label-img"
            style="width: 16px"
            src="@/assets/svgs/light_knowledge.svg"
            alt=""
          />
          <img
            v-else
            class="label-img"
            style="width: 16px"
            src="@/assets/svgs/dark_knowledge.svg"
            alt=""
          />
          <span>{{ $t('witChainD.knowledge') }}</span>
        </div>
        <div v-if="selectedTags.length" class="tags-container">
          <div v-for="(tag, index) in selectedTags" :key="index" class="tag">
            <span class="tag-text">{{ tag.kbName }}</span>
            <button class="tag-delete" @click="removeTag(index)">
              <el-icon>
                <IconXSolid />
              </el-icon>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  <Teleport to="body">
    <!-- 右侧模态框 -->
    <transition name="slide">
      <div v-if="isModalOpen" class="global-tag-modal">
        <div class="modal-header">
          <h3>{{ $t('witChainD.knowledge') }}</h3>
          <button class="close-button" @click="toggleModal">×</button>
        </div>
        <div class="multi-select-list">
          <ElInput
            v-model="searchKey"
            :placeholder="$t('witChainD.find_witChainD')"
            class="search-input"
          >
            <template #suffix>
              <img class="search-input__icon" src="@/assets/svgs/search.svg" />
            </template>
          </ElInput>
          <ul v-if="filterKnowledgeList.length">
            <el-collapse v-model="activeNames">
              <template v-for="item in filterKnowledgeList" :key="item.key">
                <el-collapse-item :name="item.key" icon="CaretLeft">
                  <template #title="{ isActive }">
                    <el-icon
                      class="el-collapse-item__arrow"
                      :class="{ 'is-active': isActive }"
                    >
                      {{ isActive }}
                      <IconCaretRight></IconCaretRight>
                    </el-icon>
                    {{ activeNames.includes(item.key) }}
                    <span>
                      {{ item.teamName }}
                    </span>
                  </template>
                  <template #icon="{ isActive }">
                    <el-icon
                      class="el-collapse-item__arrow"
                      :class="{ 'is-active': isActive }"
                    >
                      {{ isActive }}
                      <IconCaretRight></IconCaretRight>
                    </el-icon>
                    {{ activeNames.includes(item.key) }}{{ activeNames }}
                  </template>
                  <template v-for="(item, index) in item.kb_list" :key="index">
                    <div
                      class="list-item"
                      :class="{ selected: isSelected(item) }"
                      @click="selectTag(item)"
                    >
                      <div class="item-content">
                        <div class="item-header">
                          <h3 class="item-name">{{ item.kbName }}</h3>
                          <span v-if="isSelected(item)" class="checkmark">
                            <el-icon>
                              <IconCheckBold />
                            </el-icon>
                          </span>
                        </div>
                        <!-- <p class="item-description">{{ item.description }}</p> -->
                        <div class="item-description">
                          <TextMoreTootip
                            v-if="popoverVisible"
                            :value="item.description"
                            :row="2"
                            :placement="left"
                          />
                        </div>
                        <div class="item-id">ID: {{ item.kbId }}</div>
                      </div>
                    </div>
                  </template>
                </el-collapse-item>
              </template>
            </el-collapse>
          </ul>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style lang="scss" scoped>
:deep(.el-collapse-item__title) {
  line-height: 18px !important;
}
:deep(.el-collapse-item__arrow.is-active) {
  transform: rotate(90deg);
}
.search-input {
  margin-top: 8px;
  width: calc(100% - 48px) !important;
  font-size: 12px;
  border-radius: 4px;
  border-color: var(--o-border-color-lighter);
  &__icon {
    width: 16px;
    height: 16px;
  }
}

:deep(.el-collapse-item) {
  margin-bottom: 12px;
}
:deep(.el-collapse-item__content) {
  border-bottom: none;
  padding-bottom: 0px;
  margin: 2px;
}

:deep(.el-collapse-item__header) {
  display: flex;
  flex-direction: row-reverse;
  justify-content: flex-end;
  align-items: center;
  height: 16px;
  margin-bottom: 0px;
  color: #8d98aa;
  font-size: 12px;
  border-top: none;
  border-bottom: none;
  padding: 0px;
  & i {
    margin-right: 4px;
  }
}

:deep(.el-collapse-item__arrow) {
  margin: 1px 0px 0px 0px;
}

:deep(.el-collapse) {
  border-top: none;
  border-bottom: none;
}

:deep(.el-collapse-item__wrap) {
  border-bottom: 5px;
}

.search-input {
  margin-top: 8px;
  width: calc(100% - 18px);
  font-size: 12px;
  border-radius: 4px;
  border-color: var(--o-border-color-lighter);

  &__icon {
    width: 16px;
    height: 16px;
  }
}
.multi-select-container {
  max-height: 32px;
  display: inline-block;
  font-family: 'Arial', sans-serif;
  max-width: calc(100% - 148px);
  overflow: hidden;
  text-overflow: ellipsis;
  width: auto;
  position: relative;
}

.multi-select-box {
  border-radius: 8px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  background-color: var(--o-bg-color-base);
  cursor: pointer;
  max-height: 32px;
  &:hover {
    border-color: #c0c4cc;
  }

  &:focus-within {
    border-color: #409eff;
    outline: 0;
    box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
  }
}

.placeholder {
  color: #909399;
  padding: 0 8px;
}

.tags-wrapper {
  display: flex;
  align-items: center;
  overflow: hidden; /* 隐藏溢出的标签 */
  flex-grow: 1;
  height: 100%;
  white-space: nowrap; /* 防止标签换行 */
}

.select-content {
  display: flex;
  align-items: center;
  height: 100%;
  width: 100%;
  white-space: nowrap; /* 确保内容不换行 */
}

.label-text {
  font-size: 12px;
  //   color: #303133;
  color: var(--o-text-color-secondary);
  margin-right: 16px;
  white-space: nowrap;
  flex-shrink: 0; /* 防止文字被压缩 */
  display: flex;
  line-height: 32px;
  margin-left: 16px;
  .label-img {
    width: 8px;
    margin-right: 4px;
  }
  .label-img:hover {
    content: url(../../../assets/svgs/dark_knowledge_hover.svg);
  }
  .label-img:active {
    content: url(../../../assets/svgs/dark_knowledge_select.svg);
  }
}
.tags-container {
  display: inline-flex; /* 使用inline-flex确保在同一行 */
  align-items: center;
  overflow: hidden; /* 隐藏溢出的标签 */
  flex-grow: 1;
  height: 100%;
  gap: 6px;
  margin-right: 8px;
  max-width: 755px; /* 留出空间给删除按钮 */
}

.tag {
  display: flex;
  align-items: center;
  background-color: #ecf5ff;
  color: #409eff;
  border-radius: 16px;
  padding: 0 8px;
  font-size: 12px;
  height: 24px;
  line-height: 24px;
  white-space: nowrap; /* 防止标签内容换行 */
  overflow: hidden;
  text-overflow: ellipsis;
  .tag-text {
    white-space: nowrap; /* 防止标签内容换行 */
    overflow: hidden;
    text-overflow: ellipsis;
    margin-right: 5px;
  }

  .tag-delete {
    background: none;
    border: none;
    color: rgb(141, 152, 172);
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 16px;

    &:hover {
      color: #f56c6c;
      background-color: rgba(245, 108, 108, 0.1);
      border-radius: 50%;
    }
  }
}
</style>

<style lang="scss" scoped>
/* 全局样式，不使用scoped */
.global-tag-modal {
  position: fixed;
  border-radius: 8px;
  top: 60px;
  right: 16px;
  bottom: 46px;
  width: 342px;
  background-color: var(--el-bg-color);
  box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
  z-index: 99; /* 非常高的z-index确保在最上层 */
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 24px 0px 24px;

  h3 {
    margin: 0;
    font-size: 16px;
    color: var(--o-text-color-secondary);
  }

  .close-button {
    background: none;
    border: none;
    font-size: 20px;
    color: #909399;
    cursor: pointer;

    &:hover {
      color: #f56c6c;
    }
  }
}

.modal-content {
  flex: 1;
  overflow-y: auto;
  padding: 10px 0;
}

.multi-select-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  overflow: auto;
  margin: 0px 24px 16px 24px;
}

.list-item {
  position: relative;
  padding: 16px;
  border-radius: 8px;
  background-image: linear-gradient(
    to right,
    rgb(231, 243, 255),
    rgb(233, 237, 254)
  );
  cursor: pointer;
  transition: all 0.2s ease;
  width: calc(100% - 48px);
  margin-top: 8px;
  &:hover {
    outline: 1px solid #7aa5ff;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
  }

  &.selected {
    border-color: #6395fd;
    background-color: #6395fd;
    outline: 2px solid #6395fd;

    &::after {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      width: 0;
      height: 0;
      border-style: solid;
      border-width: 0 24px 24px 0;
      border-color: transparent #6395fd transparent transparent;
      border-radius: 0px 4px;
    }
  }
}

.item-content {
  display: flex;
  flex-direction: column;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.item-name {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--o-text-color-primary);
}

.checkmark {
  position: absolute;
  top: 0px;
  right: -1px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: white;
  font-weight: bold;
  font-size: 12px;
  z-index: 1;
  .el-icon {
    width: 8.75px;
    height: 7.18px;
  }
}

.item-description {
  width: 100%;
  min-height: 42.45px;
  .vue-text {
    font-size: 12px !important;
    margin: 0;
    color: var(--o-text-color-secondary) !important;
    font-size: 14px;
  }
}

.item-id {
  font-size: 12px;
  height: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #999;
  margin-top: 8px;
}
.global-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.3);
  z-index: 9998; /* 比模态框低一级，但仍然很高 */
}

/* 模态框动画 */
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}

.slide-enter-to,
.slide-leave-from {
  transform: translateX(0);
}

.popover {
  z-index: 999999;
}
</style>
