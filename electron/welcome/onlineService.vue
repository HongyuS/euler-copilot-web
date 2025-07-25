<template>
  <div class="welcome-detail-title">
    <div @click="handleBack" class="back-btn">
      <img :src="leftArrowIcon" alt="" />
      <span class="back-btn-text">{{ $t('welcome.back') }}</span>
    </div>
    <span class="divider"></span>
    <div class="welcome-detail-title-text">
      {{ $t('welcome.onlineService') }}
    </div>
  </div>
  <el-form
    ref="ruleFormRef"
    label-position="left"
    label-width="auto"
    :model="ruleForm"
    :rules="rules"
    class="online-ruleForm"
    style="max-width: 600px"
  >
    <el-form-item
      :label="$t('onlineService.serviceUrl')"
      prop="url"
      label-position="left"
    >
      <el-input
        :placeholder="$t('welcome.pleaseInput')"
        v-model="ruleForm.url"
        @change="handleUrlChange"
        @blur="handleUrlBlur"
      />
    </el-form-item>
  </el-form>
  <div class="submit-btn">
    <el-button
      type="primary"
      :disabled="isConfirmDisabled"
      @click="handleConfirm(ruleFormRef)"
    >
      {{ $t('welcome.confirm') }}
    </el-button>
  </div>
</template>

<script lang="ts" setup>
import { reactive, ref, onMounted } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessageBox } from 'element-plus';
import leftArrowIcon from './assets/svgs/left_arrow.svg';
import i18n from './lang/index';

const props = withDefaults(
  defineProps<{
    back: () => void;
  }>(),
  {},
);

interface RuleForm {
  url: string;
}

const ruleForm = reactive<RuleForm>({
  url: '',
});
const ruleFormRef = ref<FormInstance>();

const checkUrlValid = (_rule, value, callback) => {
  // 这里校验各个url链接
  if (window.eulercopilotWelcome?.config) {
    window.eulercopilotWelcome.config
      .validateServer(value)
      .then(({ isValid, error }) => {
        if (!isValid) {
          callback(error);
        } else {
          callback();
        }
      })
      .catch((err) => {
        callback(i18n.global.t('welcome.validationFailure'), err);
      });
  }
};

const rules = reactive<FormRules<RuleForm>>({
  url: [
    {
      required: true,
      message:
        i18n.global.t('welcome.pleaseInput') +
        i18n.global.t('onlineService.serviceUrl'),
      trigger: ['change', 'blur'],
    },
    {
      type: 'url',
      message: i18n.global.t('welcome.validUrl'),
      trigger: ['blur'],
    },
    { validator: checkUrlValid, trigger: ['blur'] },
  ],
});

const isConfirmDisabled = ref(true);

const handleUrlChange = () => {
  if (!ruleFormRef.value) return;
  ruleFormRef.value.validate((valid) => {
    isConfirmDisabled.value = !valid;
  });
};

const handleUrlBlur = () => {
  handleUrlChange();
};

onMounted(() => {
  // 组件挂载后进行一次表单验证
  if (ruleFormRef.value && ruleForm.url) {
    handleUrlChange();
  }
});

const handleConfirm = async (formEl: FormInstance | undefined) => {
  if (!formEl) return;

  // 先进行表单验证
  const isFormValid = await new Promise<boolean>((resolve) => {
    formEl.validate((valid, fields) => {
      if (!valid) {
        console.error('表单验证失败:', fields);
        resolve(false);
        return;
      }
      resolve(true);
    });
  });

  if (!isFormValid) return;

  // 验证服务器连接
  if (window.eulercopilotWelcome?.config) {
    try {
      const { isValid, error } =
        await window.eulercopilotWelcome.config.validateServer(ruleForm.url);

      if (!isValid) {
        // 弹窗提醒用户连接失败
        await ElMessageBox.alert(
          error || i18n.global.t('welcome.validationFailure'),
          i18n.global.t('welcome.connectionFailed'),
          {
            confirmButtonText: i18n.global.t('welcome.confirm'),
            type: 'error',
          },
        );
        return;
      }

      // 验证成功，设置代理 URL
      await window.eulercopilotWelcome.config.setProxyUrl(ruleForm.url);
    } catch (error) {
      // 网络错误或其他异常
      console.error('服务器验证失败:', error);
      await ElMessageBox.alert(
        i18n.global.t('welcome.validationFailure'),
        i18n.global.t('welcome.connectionFailed'),
        {
          confirmButtonText: i18n.global.t('welcome.confirm'),
          type: 'error',
        },
      );
      return;
    }
  }

  // 完成欢迎页面流程
  if (window.eulercopilotWelcome?.welcome) {
    await window.eulercopilotWelcome.welcome.complete();
  }
};

const handleBack = () => {
  props.back();
};
</script>
<style lang="scss" scoped>
.online-ruleForm {
  margin: 0 48px 0 40px;
}
.submit-btn {
  width: 100vw;
  display: flex;
  justify-content: center;
  position: absolute;
  bottom: 24px;
  button {
    padding: 8px 25px;
  }
}
.el-form-item:not(.is-error) .el-input__wrapper {
  background-color: transparent !important;
}
.el-form-item.is-error .el-input__wrapper {
  background-color: rgb(247, 193, 193);
}
</style>
