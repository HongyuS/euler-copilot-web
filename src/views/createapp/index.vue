<script setup lang="ts">
import '../styles/createApp.scss';
import { onMounted, onUnmounted, ref } from 'vue';
import AppConfig from './components/appConfig.vue';
import WorkFlow from './components/workFlow.vue';
import CustomLoading from '../customLoading/index.vue';
import { useRouter, useRoute } from 'vue-router';
import { api } from 'src/apis';
import { ElMessage } from 'element-plus';
import { IconSuccess, IconRemind } from '@computing/opendesign-icons';
import AgentAppConfig from './components/AgentAppConfig.vue';
import i18n from 'src/i18n';

const { t } = i18n.global;
const router = useRouter();
const route = useRoute();
const publishStatus = ref('未发布');
const publishValidate = ref(false);
const appFormValidate = ref<boolean>(false);
const createAppType = ref('appConfig');
const appConfigRef = ref();
const workFlowRef = ref();
const flowList = ref([]);
const loading = ref(false);

const appType = ref(route.query.type);

const handleChangeAppType = (type) => {
  createAppType.value = type;
  // 切换createAppType【tab值】时，将其保存在sessionStorage，刷新时保证不变
  sessionStorage.setItem('createAppType', type);
};

// 初始化
onMounted(() => {
  // 判断是否有sessionStorage存储当前的tab页面
  const currentAppType = sessionStorage.getItem('createAppType');
  // 如果sessionStorage保存了新建应用中心的createAppType【tab值】，则回显
  if (currentAppType) {
    createAppType.value = currentAppType;
  }
});

onUnmounted(() => {
  // 组件销毁时，清空保存新建应用中心的createAppType【tab值】
  sessionStorage.setItem('createAppType', '');
});

// 需要界面配置校验与工作流校验同时通过
const handlePublishApp = async () => {
  // 发布接口前，先保存界面配置与工作流
  try {
    await saveApp(appType.value as 'agent' | 'flow').then(() => {
      api
        .releaseSingleAppData({
          appId: route.query?.appId as string,
        })
        .then((res) => {
          if (res[1]?.result) {
            ElMessage.success(t('app.publishSuccess'));
            router.push(`/app`);
            loading.value = false;
          }
        });
    });
  } catch {
    ElMessage.error(t('app.publishFailed'));
  }
};

const handleValidateContent = (valid: boolean) => {
  appFormValidate.value = valid;
};

// 获取当前的应用中的各flowsDebug的情况
const updateFlowsDebug = (status?: boolean, flow?: any) => {
  // 如果status为false,直接置为False不再调接口

  if (status === false) {
    publishValidate.value = false;
    //在修改工作流以及界面配置时，需要重新校验工作流，状态置为未发布
    publishStatus.value = '未发布';
    return;
  }
  if (flow) {
    judgeAppFlowsDebug(flow);
  }
};

// 获取工作流列表
const getFlowList = (flowDataList) => {
  flowList.value = flowDataList;
  judgeAppFlowsDebug(flowDataList);
};

const judgeAppFlowsDebug = (flowDataList) => {
  // 判断应用下的所有工作流当前是否debug通过
  const flowsDebug = flowDataList.every((item) => item?.debug);
  // 初始化时，获取发布的校验结果---必须有工作流且所有工作流必须debug通过
  publishValidate.value = flowDataList?.length > 0 && flowsDebug;
};
// 保存功能
const handleCreateOrUpdateApp = async () => {
  loading.value = true;
  let appFormValue = appConfigRef.value.createAppForm;
  if (appFormValue) {
    await api.createOrUpdateApp({
      appId: route.query?.appId as string,
      appType: appType.value as 'agent' | 'flow',
      icon: appFormValue.icon,
      name: appFormValue.name,
      description: appFormValue.description,
      links: appFormValue.links.map((item) => {
        return { url: item, title: '' };
      }),
      recommendedQuestions: appFormValue.recommendedQuestions,
      dialogRounds: appFormValue.dialogRounds,
      permission: appFormValue.permission,
    });
  }
  loading.value = false;
};

// 保存按钮处理方法
const saveApp = async (type: 'agent' | 'flow') => {
  try {
    if (type === 'flow') {
      await handleCreateOrUpdateApp();
      await workFlowRef.value.saveFlow(false, true);
      ElMessage({
        showClose: true,
        message: t('app.updateSuccessfully'),
        icon: IconSuccess,
        customClass: 'o-message--success',
        duration: 2000,
      });
    } else if (type === 'agent') {
      const formData = agentAppConfigRef.value.createAppForm;
      if (!formData) return;
      const [, res] = await api.createOrUpdateApp({
        appId: route.query?.appId as string,
        appType: type,
        icon: formData.icon,
        name: formData.name,
        description: formData.description,
        dialogRounds: formData.dialogRounds,
        mcpService: formData.mcps,
        permission: formData.permission,
      });
      if (res) {
        ElMessage({
          showClose: true,
          message: t('app.updateSuccessfully'),
          icon: IconSuccess,
          customClass: 'o-message--success',
          duration: 2000,
        });
      }
    }
    return true;
  } catch {
    return false;
  }
};

const getPublishStatus = (status) => {
  if (status) {
    publishStatus.value = '已发布';
  } else {
    publishStatus.value = '未发布';
  }
};

const handleJumperAppCenter = () => {
  router.push('/app?to=createdByMe');
};

const agentAppConfigRef = ref();
function onDebugClick() {
  if (agentAppConfigRef.value) {
    agentAppConfigRef.value.openDebugDialog();
  }
}

function onDebugSuccess(status: boolean) {
  publishValidate.value = status;
}
</script>
<template>
  <div class="createAppContainer">
    <CustomLoading :loading="loading"></CustomLoading>
    <div class="createAppContainerTop">
      <div class="createAppContainerMenu">
        <div class="createAppContainerMenuLeft">
          <span
            class="createAppContainerMenuCenter"
            @click="handleJumperAppCenter"
          >
            {{ $t('menu.app_center') }}
          </span>
          <span>/</span>
          <span class="createAppContainerMenuText">
            {{ appType === 'flow' ? $t('app.workflow_app') : $t('app.mcp_app') }}
          </span>
        </div>
        <div
          class="createAppContainerStatus"
          :class="{ debugSuccess: publishStatus === '已发布' }"
        >
          {{
            publishStatus === '已发布'
              ? $t('app.app_published')
              : $t('app.unpublished')
          }}
        </div>
      </div>
      <div class="createAppContainerType" v-if="appType !== 'agent'">
        <div
          class="createAppBtn"
          :class="{ createAppBtnActive: createAppType === 'appConfig' }"
          @click="handleChangeAppType('appConfig')"
        >
          <div>{{ $t('app.app_config') }}</div>
          <el-icon v-if="appFormValidate">
            <IconSuccess />
          </el-icon>
          <el-icon v-else class="warningRemind">
            <IconRemind />
          </el-icon>
        </div>
        <div
          class="createAppBtn"
          :class="{ createAppBtnActive: createAppType !== 'appConfig' }"
          @click="handleChangeAppType('workFlow')"
        >
          <div>{{ $t('flow.edit_workflow') }}</div>
          <el-icon v-if="publishValidate">
            <IconSuccess />
          </el-icon>
          <el-icon v-else class="warningRemind">
            <IconRemind />
          </el-icon>
        </div>
      </div>
    </div>
    <div class="createAppContainerMain" v-show="createAppType === 'appConfig'">
      <AppConfig
        v-if="appType === 'flow'"
        :handleValidateContent="handleValidateContent"
        @getFlowList="getFlowList"
        @getPublishStatus="getPublishStatus"
        ref="appConfigRef"
      />
      <AgentAppConfig
        ref="agentAppConfigRef"
        v-else-if="appType === 'agent'"
        :handleValidateContent="handleValidateContent"
        :onDebug="onDebugSuccess"
      />
    </div>
    <div
      class="createWorkFlowContainerMain"
      v-show="createAppType !== 'appConfig'"
    >
      <WorkFlow
        @updateFlowsDebug="updateFlowsDebug"
        :flowList="flowList"
        ref="workFlowRef"
      />
    </div>

    <div class="createAppContainerFooter">
      <el-button @click="handleJumperAppCenter">
        {{ $t('semantic.cancel') }}
      </el-button>
      <el-button
        @click="saveApp(appType as 'agent' | 'flow')"
        :disabled="createAppType === 'appConfig' ? !appFormValidate : false"
      >
        {{ $t('semantic.save') }}
      </el-button>
      <el-button :disabled="appType !== 'agent'" @click="onDebugClick">
        {{ appType === 'flow' ? $t('semantic.preview') : $t('flow.debug') }}
      </el-button>
      <el-tooltip
        :disabled="publishValidate"
        :content="$t('semantic.publish_condition')"
        placement="top"
      >
        <!-- 需要多一层，不然影响当前el-tooltip显示content -->
        <div>
          <el-button
            type="primary"
            :disabled="!publishValidate"
            @click="handlePublishApp()"
          >
            {{ $t('semantic.publish') }}
          </el-button>
        </div>
      </el-tooltip>
    </div>
  </div>
</template>
<style lang="scss">
/* 滚动条轨道样式 */
</style>
