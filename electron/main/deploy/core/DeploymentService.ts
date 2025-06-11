// Copyright (c) Huawei Technologies Co., Ltd. 2023-2025. All rights reserved.
// licensed under the Mulan PSL v2.
// You can use this software according to the terms and conditions of the Mulan PSL v2.
// You may obtain a copy of Mulan PSL v2 at:
//      http://license.coscl.org.cn/MulanPSL2
// THIS SOFTWARE IS PROVIDED ON AN 'AS IS' BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY OR FIT FOR A PARTICULAR
// PURPOSE.
// See the Mulan PSL v2 for more details.

import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { getCachePath } from '../../common/cache-conf';
import type {
  DeploymentParams,
  DeploymentStatus,
} from '../types/deployment.types';
import {
  EnvironmentChecker,
  type EnvironmentCheckResult,
} from './EnvironmentChecker';
import { ValuesYamlManager } from './ValuesYamlManager';

/**
 * 支持中断的异步执行函数
 */
const execAsyncWithAbort = (
  command: string,
  options: any = {},
  abortSignal?: AbortSignal,
): Promise<{ stdout: string; stderr: string }> => {
  return new Promise((resolve, reject) => {
    const childProcess = exec(command, options, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({
          stdout: typeof stdout === 'string' ? stdout : stdout.toString(),
          stderr: typeof stderr === 'string' ? stderr : stderr.toString(),
        });
      }
    });

    // 如果提供了中断信号，监听中断事件
    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        childProcess.kill('SIGTERM');
        reject(new Error('部署进程已被用户停止'));
      });
    }
  });
};

/**
 * 部署服务核心类
 */
export class DeploymentService {
  private cachePath: string;
  private deploymentPath: string;
  private environmentChecker: EnvironmentChecker;
  private valuesYamlManager: ValuesYamlManager;
  private environmentCheckResult?: EnvironmentCheckResult;
  private currentStatus: DeploymentStatus = {
    status: 'idle',
    message: '',
    currentStep: 'idle',
  };
  private statusCallback?: (status: DeploymentStatus) => void;
  private abortController?: AbortController;
  private currentProcess?: any;
  private sudoSessionActive: boolean = false;

  constructor() {
    this.cachePath = getCachePath();
    // 创建专门的部署工作目录
    this.deploymentPath = path.join(
      this.cachePath,
      'deployment',
      'euler-copilot-framework',
    );
    this.environmentChecker = new EnvironmentChecker();
    this.valuesYamlManager = new ValuesYamlManager();
  }

  /**
   * 设置状态回调函数
   */
  setStatusCallback(callback: (status: DeploymentStatus) => void) {
    this.statusCallback = callback;
  }

  /**
   * 更新部署状态
   */
  private updateStatus(status: Partial<DeploymentStatus>) {
    // 验证输入状态
    if (!status || typeof status !== 'object') {
      if (process.env.NODE_ENV === 'development') {
        console.warn('DeploymentService: 尝试更新无效状态:', status);
      }
      return;
    }

    this.currentStatus = { ...this.currentStatus, ...status };

    // 确保 currentStep 总是存在
    if (!this.currentStatus.currentStep) {
      this.currentStatus.currentStep = 'unknown';
    }

    // 调试信息：仅在开发环境下记录状态更新
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 DeploymentService: 状态更新', {
        status: this.currentStatus.status,
        currentStep: this.currentStatus.currentStep,
        message: this.currentStatus.message,
        hasCallback: !!this.statusCallback,
      });
    }

    if (this.statusCallback) {
      try {
        this.statusCallback(this.currentStatus);
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ DeploymentService: 状态回调已调用');
        }
      } catch (error) {
        console.error('❌ DeploymentService: 状态回调执行失败:', error);
      }
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ DeploymentService: 没有设置状态回调函数');
      }
    }
  }

  /**
   * 获取当前状态
   */
  getStatus(): DeploymentStatus {
    return { ...this.currentStatus };
  }

  /**
   * 开始部署流程
   */
  async startDeployment(params: DeploymentParams): Promise<void> {
    try {
      // 创建新的 AbortController 用于控制部署流程
      this.abortController = new AbortController();

      // 第一阶段：准备安装环境
      this.updateStatus({
        status: 'preparing',
        message: '准备安装环境...',
        currentStep: 'preparing-environment',
      });

      // 1. 检查环境
      await this.checkEnvironment();

      // 2. 在Linux系统上，一次性获取sudo权限并保持会话
      await this.initializeSudoSession();

      // 3. 克隆仓库
      await this.cloneRepository();

      // 4. 配置 values.yaml
      await this.configureValues(params);

      // 5. 执行部署脚本中的工具安装部分（如果需要）
      await this.installTools();

      // 6. 验证K8s集群状态
      await this.verifyK8sCluster();

      // 更新准备环境完成状态
      this.updateStatus({
        message: '准备安装环境完成',
        currentStep: 'environment-ready',
      });

      // 第二到第四阶段：按顺序安装各个服务
      await this.executeDeploymentScripts();

      this.updateStatus({
        status: 'success',
        message: '部署完成！',
        currentStep: 'completed',
      });
    } catch (error) {
      // 如果是因为手动停止导致的错误，使用停止状态
      if (this.abortController?.signal.aborted) {
        this.updateStatus({
          status: 'idle',
          message: '部署已停止',
          currentStep: 'stopped',
        });
      } else {
        // 如果错误还没有被处理（设置status为error），在这里处理
        if (this.currentStatus.status !== 'error') {
          const friendlyMessage = this.getUserFriendlyErrorMessage(
            error,
            '部署过程',
          );
          this.updateStatus({
            status: 'error',
            message: friendlyMessage,
            currentStep: 'failed',
          });
        }
        throw error;
      }
    } finally {
      // 清理资源
      this.abortController = undefined;
      this.currentProcess = undefined;
      this.sudoSessionActive = false; // 重置sudo会话状态
    }
  }

  /**
   * 检查环境
   */
  private async checkEnvironment(): Promise<void> {
    try {
      this.updateStatus({
        status: 'preparing',
        message: '检查系统环境...',
        currentStep: 'preparing-environment',
      });

      // 检查 root 权限（仅限 Linux）
      try {
        await this.checkRootPermission();
      } catch (error) {
        throw new Error(
          `权限检查失败: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      let checkResult;
      try {
        checkResult = await this.environmentChecker.checkAll();
      } catch (error) {
        throw new Error(
          `系统环境检查失败: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // 安装缺失的基础工具
      if (checkResult.needsBasicToolsInstall) {
        try {
          this.updateStatus({
            message: '安装缺失的基础工具...',
            currentStep: 'preparing-environment',
          });

          await this.environmentChecker.installBasicTools(
            checkResult.missingBasicTools,
          );

          this.updateStatus({
            message: '基础工具安装完成',
            currentStep: 'preparing-environment',
          });
        } catch (error) {
          throw new Error(
            `基础工具安装失败: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      // 检查是否有严重错误
      if (!checkResult.success) {
        throw new Error(`环境检查未通过: ${checkResult.errors.join(', ')}`);
      }

      // 存储检查结果，用于后续决定是否需要执行 2-install-tools
      this.environmentCheckResult = checkResult;

      this.updateStatus({
        message: '环境检查通过',
        currentStep: 'preparing-environment',
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.updateStatus({
        status: 'error',
        message: `环境检查阶段失败: ${errorMessage}`,
        currentStep: 'preparing-environment',
      });
      throw error;
    }
  }

  /**
   * 克隆远程仓库
   */
  private async cloneRepository(): Promise<void> {
    try {
      this.updateStatus({
        status: 'cloning',
        message: '克隆部署仓库...',
        currentStep: 'preparing-environment',
      });

      // 确保部署目录的父目录存在
      const deploymentParentDir = path.dirname(this.deploymentPath);
      try {
        if (!fs.existsSync(deploymentParentDir)) {
          fs.mkdirSync(deploymentParentDir, { recursive: true });
        }
      } catch (error) {
        throw new Error(
          `创建部署目录失败: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // 检查是否已经克隆过
      const gitDir = path.join(this.deploymentPath, '.git');
      if (fs.existsSync(gitDir)) {
        try {
          // 已存在，执行 git pull 更新
          await execAsyncWithAbort(
            'git pull origin master',
            { cwd: this.deploymentPath },
            this.abortController?.signal,
          );
          this.updateStatus({
            message: '更新部署仓库完成',
            currentStep: 'preparing-environment',
          });
        } catch (error) {
          throw new Error(
            `更新仓库失败: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      } else {
        try {
          // 不存在，克隆仓库
          const repoUrl =
            'https://gitee.com/openeuler/euler-copilot-framework.git';
          await execAsyncWithAbort(
            `git clone ${repoUrl} ${path.basename(this.deploymentPath)}`,
            {
              cwd: deploymentParentDir,
            },
            this.abortController?.signal,
          );
          this.updateStatus({
            message: '克隆部署仓库完成',
            currentStep: 'preparing-environment',
          });
        } catch (error) {
          throw new Error(
            `克隆仓库失败: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.updateStatus({
        status: 'error',
        message: `仓库操作阶段失败: ${errorMessage}`,
        currentStep: 'preparing-environment',
      });
      throw error;
    }
  }

  /**
   * 配置 values.yaml 文件
   */
  private async configureValues(params: DeploymentParams): Promise<void> {
    try {
      this.updateStatus({
        status: 'configuring',
        message: '配置部署参数...',
        currentStep: 'preparing-environment',
      });

      const valuesPath = path.join(
        this.deploymentPath,
        'deploy/chart/euler_copilot/values.yaml',
      );

      // 检查 values.yaml 文件是否存在
      if (!fs.existsSync(valuesPath)) {
        throw new Error(`配置文件不存在: ${valuesPath}`);
      }

      try {
        await this.valuesYamlManager.updateModelsConfig(valuesPath, params);
      } catch (error) {
        throw new Error(
          `更新配置文件失败: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      this.updateStatus({
        message: '配置部署参数完成',
        currentStep: 'preparing-environment',
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.updateStatus({
        status: 'error',
        message: `配置阶段失败: ${errorMessage}`,
        currentStep: 'preparing-environment',
      });
      throw error;
    }
  }

  /**
   * 安装工具（准备环境的一部分）
   */
  private async installTools(): Promise<void> {
    try {
      // 检查是否需要安装 K8s 工具
      if (!this.environmentCheckResult?.needsK8sToolsInstall) {
        this.updateStatus({
          message: 'K8s 工具已存在，跳过工具安装',
          currentStep: 'preparing-environment',
        });
        return;
      }

      this.updateStatus({
        status: 'preparing',
        message: '安装 K8s 工具 (kubectl, helm, k3s)...',
        currentStep: 'preparing-environment',
      });

      const scriptsPath = path.join(this.deploymentPath, 'deploy/scripts');
      const toolsScriptPath = path.join(
        scriptsPath,
        '2-install-tools/install_tools.sh',
      );

      // 检查脚本文件是否存在
      if (!fs.existsSync(toolsScriptPath)) {
        throw new Error(`工具安装脚本不存在: ${toolsScriptPath}`);
      }

      try {
        // 构建需要权限的命令，使用已建立的sudo会话
        const command = this.buildRootCommand(
          toolsScriptPath,
          false,
          undefined,
          {
            KUBECONFIG: '/etc/rancher/k3s/k3s.yaml',
          },
        );

        // 执行脚本
        await execAsyncWithAbort(
          command,
          {
            cwd: scriptsPath,
            timeout: 600000, // 10分钟超时，k3s安装可能需要较长时间
          },
          this.abortController?.signal,
        );
      } catch (error) {
        // 检查是否是超时错误
        if (error instanceof Error && error.message.includes('timeout')) {
          throw new Error('K8s 工具安装超时，可能网络较慢或下载失败');
        }
        throw new Error(
          `K8s 工具安装执行失败: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      this.updateStatus({
        message: 'K8s 工具安装完成',
        currentStep: 'preparing-environment',
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.updateStatus({
        status: 'error',
        message: `工具安装阶段失败: ${errorMessage}`,
        currentStep: 'preparing-environment',
      });
      throw error;
    }
  }

  /**
   * 验证K8s集群状态（确保k3s正常运行）
   */
  private async verifyK8sCluster(): Promise<void> {
    // 只在 Linux 系统上需要验证k3s
    if (process.platform !== 'linux') {
      return;
    }

    try {
      this.updateStatus({
        status: 'preparing',
        message: '验证 K8s 集群状态...',
        currentStep: 'preparing-environment',
      });

      // 1. 检查k3s服务状态
      try {
        await this.checkK3sService();
      } catch (error) {
        throw new Error(
          `k3s 服务检查失败: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // 2. 等待k3s服务完全启动
      try {
        await this.waitForK3sReady();
      } catch (error) {
        throw new Error(
          `k3s 服务启动验证失败: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // 3. 验证kubectl连接
      try {
        await this.verifyKubectlConnection();
      } catch (error) {
        throw new Error(
          `kubectl 连接验证失败: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      this.updateStatus({
        message: 'K8s 集群验证通过',
        currentStep: 'preparing-environment',
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.updateStatus({
        status: 'error',
        message: `K8s 集群验证阶段失败: ${errorMessage}`,
        currentStep: 'preparing-environment',
      });
      throw error;
    }
  }

  /**
   * 检查k3s服务状态
   */
  private async checkK3sService(): Promise<void> {
    try {
      const { stdout } = await execAsyncWithAbort(
        'systemctl is-active k3s',
        {},
        this.abortController?.signal,
      );

      if (stdout.trim() !== 'active') {
        // 尝试启动k3s服务
        const sudoCommand = this.getSudoCommand();
        await execAsyncWithAbort(
          `${sudoCommand}systemctl start k3s`,
          { timeout: 30000 },
          this.abortController?.signal,
        );

        // 再次检查状态
        const { stdout: newStatus } = await execAsyncWithAbort(
          'systemctl is-active k3s',
          {},
          this.abortController?.signal,
        );

        if (newStatus.trim() !== 'active') {
          throw new Error('k3s 服务启动失败');
        }
      }
    } catch (error) {
      throw new Error(
        `k3s 服务检查失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 等待k3s服务完全启动（最多等待60秒）
   */
  private async waitForK3sReady(): Promise<void> {
    const maxWaitTime = 60000; // 60秒
    const checkInterval = 5000; // 5秒检查一次
    const startTime = Date.now();
    const sudoCommand = this.getSudoCommand();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        // 检查k3s.yaml文件是否存在且可读
        const { stdout } = await execAsyncWithAbort(
          `${sudoCommand}ls -la /etc/rancher/k3s/k3s.yaml`,
          {},
          this.abortController?.signal,
        );

        if (stdout.includes('k3s.yaml')) {
          // 文件存在，等待几秒确保内容完整
          await new Promise((resolve) => setTimeout(resolve, 3000));
          return;
        }
      } catch {
        // 文件还不存在，继续等待
      }

      // 等待一段时间后重试
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    throw new Error('k3s 配置文件生成超时，服务可能启动失败');
  }

  /**
   * 验证kubectl连接
   */
  private async verifyKubectlConnection(): Promise<void> {
    try {
      // 设置KUBECONFIG环境变量并测试连接
      const kubeconfigPath = '/etc/rancher/k3s/k3s.yaml';
      const sudoCommand = this.getSudoCommand();

      // 使用sudo权限执行kubectl命令，因为k3s.yaml文件只有root用户可以读取
      const { stdout } = await execAsyncWithAbort(
        `${sudoCommand}bash -c 'KUBECONFIG=${kubeconfigPath} kubectl cluster-info'`,
        { timeout: 15000 },
        this.abortController?.signal,
      );

      if (!stdout.includes('is running at')) {
        throw new Error('kubectl 无法连接到 k3s 集群');
      }

      // 验证节点状态
      const { stdout: nodeStatus } = await execAsyncWithAbort(
        `${sudoCommand}bash -c 'KUBECONFIG=${kubeconfigPath} kubectl get nodes'`,
        { timeout: 15000 },
        this.abortController?.signal,
      );

      if (!nodeStatus.includes('Ready')) {
        throw new Error('k3s 节点状态异常');
      }
    } catch (error) {
      throw new Error(
        `kubectl 连接验证失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 执行部署脚本
   */
  private async executeDeploymentScripts(): Promise<void> {
    const scriptsPath = path.join(this.deploymentPath, 'deploy/scripts');

    // 按照 timeLine.vue 中的步骤定义，执行指定的脚本（排除工具安装，因为已在准备环境阶段执行）
    const scripts = [
      {
        name: '6-install-databases',
        path: '6-install-databases/install_databases.sh',
        displayName: '数据库服务',
        step: 'install-databases',
        envVars: {},
      },
      {
        name: '7-install-authhub',
        path: '7-install-authhub/install_authhub.sh',
        displayName: 'AuthHub 服务',
        step: 'install-authhub',
        envVars: {
          // 通过环境变量或输入重定向避免交互
          AUTHHUB_DOMAIN: 'authhub.eulercopilot.local',
        },
        useInputRedirection: true, // 标记需要输入重定向
      },
      {
        name: '8-install-EulerCopilot',
        path: '8-install-EulerCopilot/install_eulercopilot.sh',
        displayName: 'Intelligence 服务',
        step: 'install-intelligence',
        envVars: {
          // install_eulercopilot.sh 已支持这些环境变量
          EULERCOPILOT_DOMAIN: 'www.eulercopilot.local',
          AUTHHUB_DOMAIN: 'authhub.eulercopilot.local',
          // 设置非交互模式标志
          CI: 'true',
          DEBIAN_FRONTEND: 'noninteractive',
        },
      },
    ];

    for (let i = 0; i < scripts.length; i++) {
      const script = scripts[i];

      try {
        this.updateStatus({
          status: 'deploying',
          message: `正在安装 ${script.displayName}...`,
          currentStep: script.step,
        });

        const scriptPath = path.join(scriptsPath, script.path);

        // 检查脚本文件是否存在
        if (!fs.existsSync(scriptPath)) {
          throw new Error(`脚本文件不存在: ${scriptPath}`);
        }

        // 在执行脚本前刷新sudo会话（除第一个脚本外）
        if (i > 0) {
          try {
            await this.refreshSudoSession();
          } catch (error) {
            if (process.env.NODE_ENV === 'development') {
              console.warn(`刷新sudo会话失败，继续执行: ${error}`);
            }
          }
        }

        // 准备环境变量，过滤掉 undefined 值
        const baseEnv = {
          ...process.env,
          ...script.envVars,
          // 确保 KUBECONFIG 环境变量正确设置
          KUBECONFIG: '/etc/rancher/k3s/k3s.yaml',
        };

        // 过滤掉 undefined 值，确保所有值都是字符串
        const execEnv = Object.fromEntries(
          Object.entries(baseEnv).filter(([, value]) => value !== undefined),
        ) as Record<string, string>;

        // 构建需要权限的命令
        const command = this.buildRootCommand(
          scriptPath,
          script.useInputRedirection,
          script.useInputRedirection ? 'authhub.eulercopilot.local' : undefined,
          execEnv,
        );

        try {
          // 给脚本添加执行权限并执行
          await execAsyncWithAbort(
            command,
            {
              cwd: scriptsPath,
              timeout: 600000, // 10分钟超时，某些服务安装可能需要较长时间
            },
            this.abortController?.signal,
          );
        } catch (error) {
          // 检查是否是超时错误
          if (error instanceof Error && error.message.includes('timeout')) {
            throw new Error(
              `${script.displayName} 安装超时，可能网络较慢或下载失败`,
            );
          }
          // 检查是否是权限错误
          if (
            error instanceof Error &&
            (error.message.includes('permission denied') ||
              error.message.includes('Access denied'))
          ) {
            throw new Error(
              `${script.displayName} 安装权限不足，请确保有管理员权限`,
            );
          }
          // 检查是否是网络错误
          if (
            error instanceof Error &&
            (error.message.includes('network') ||
              error.message.includes('connection') ||
              error.message.includes('resolve'))
          ) {
            throw new Error(
              `${script.displayName} 安装网络错误，请检查网络连接`,
            );
          }
          throw new Error(
            `${script.displayName} 安装失败: ${error instanceof Error ? error.message : String(error)}`,
          );
        }

        // 更新完成状态
        this.updateStatus({
          message: `${script.displayName} 安装完成`,
          currentStep: script.step,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.updateStatus({
          status: 'error',
          message: `${script.displayName} 安装失败: ${errorMessage}`,
          currentStep: script.step,
        });
        throw error;
      }
    }
  }

  /**
   * 检查并确保有 root 权限或 sudo 权限（仅限 Linux 系统）
   */
  private async checkRootPermission(): Promise<void> {
    // 只在 Linux 系统上检查权限
    if (process.platform !== 'linux') {
      return;
    }

    try {
      // 检查当前用户 ID，0 表示 root
      const { stdout } = await execAsyncWithAbort(
        'id -u',
        {},
        this.abortController?.signal,
      );
      const uid = parseInt(stdout.trim(), 10);

      // 如果是 root 用户，直接通过
      if (uid === 0) {
        return;
      }

      // 如果不是 root 用户，检查是否有 sudo 权限
      try {
        // 检查用户是否在管理员组中（sudo、wheel、admin）
        const { stdout: groupsOutput } = await execAsyncWithAbort(
          'groups',
          {},
          this.abortController?.signal,
        );
        const userGroups = groupsOutput.trim().split(/\s+/);

        // 检查常见的管理员组
        const adminGroups = ['sudo', 'wheel', 'admin'];
        const hasAdminGroup = adminGroups.some((group) =>
          userGroups.includes(group),
        );

        if (hasAdminGroup) {
          // 用户在管理员组中，具有 sudo 权限
          // 在实际执行时，buildRootCommand 会使用适当的图形化 sudo 工具
          return;
        }

        // 如果不在管理员组中，尝试检查是否有无密码 sudo 权限
        try {
          await execAsyncWithAbort(
            'sudo -n true',
            { timeout: 3000 },
            this.abortController?.signal,
          );
          // 如果成功，说明用户有无密码 sudo 权限
          return;
        } catch {
          // 用户既不在管理员组中，也没有无密码 sudo 权限
          throw new Error(
            '部署脚本需要管理员权限才能执行。请确保当前用户具有 sudo 权限。',
          );
        }
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes('部署脚本需要管理员权限')
        ) {
          throw error;
        }
        // 无法检查组信息，假设用户可能有权限，在实际执行时再处理
        // 这样避免过于严格的权限检查阻止部署
        return;
      }
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('部署脚本需要 root 权限') ||
          error.message.includes('用户具有管理员权限'))
      ) {
        throw error;
      }
      throw new Error('无法检查用户权限');
    }
  }

  /**
   * 初始化sudo会话，一次性获取权限并保持会话
   */
  private async initializeSudoSession(): Promise<void> {
    // 只在 Linux 系统上需要sudo会话
    if (process.platform !== 'linux') {
      return;
    }

    // 检查是否为root用户，如果是则不需要sudo
    if (process.getuid && process.getuid() === 0) {
      this.sudoSessionActive = true;
      return;
    }

    try {
      this.updateStatus({
        status: 'preparing',
        message: '获取管理员权限...',
        currentStep: 'preparing-environment',
      });

      // 使用pkexec或其他图形化sudo工具一次性获取权限
      // 这里执行一个简单的sudo命令来激活会话
      const sudoCommand = this.getSudoCommand();
      await execAsyncWithAbort(
        `${sudoCommand}true`,
        { timeout: 60000 }, // 60秒超时，给用户足够时间输入密码
        this.abortController?.signal,
      );

      this.sudoSessionActive = true;

      this.updateStatus({
        message: '管理员权限获取成功',
        currentStep: 'preparing-environment',
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // 检查是否是用户取消操作
      if (
        errorMessage.includes('cancelled') ||
        errorMessage.includes('aborted')
      ) {
        throw new Error('用户取消了权限授权操作');
      }

      // 检查是否是权限被拒绝
      if (
        errorMessage.includes('authentication') ||
        errorMessage.includes('permission')
      ) {
        throw new Error(
          '管理员权限验证失败，请确保密码正确或用户具有管理员权限',
        );
      }

      this.updateStatus({
        status: 'error',
        message: `权限获取阶段失败: ${errorMessage}`,
        currentStep: 'preparing-environment',
      });

      throw new Error(`获取管理员权限失败: ${errorMessage}`);
    }
  }

  /**
   * 刷新sudo会话时间戳，延长会话时间
   */
  private async refreshSudoSession(): Promise<void> {
    if (process.platform !== 'linux' || !this.sudoSessionActive) {
      return;
    }

    // 检查是否为root用户
    if (process.getuid && process.getuid() === 0) {
      return;
    }

    try {
      // 使用 sudo -v 刷新时间戳，无需重新输入密码
      await execAsyncWithAbort(
        'sudo -v',
        { timeout: 5000 },
        this.abortController?.signal,
      );
    } catch (error) {
      // 如果刷新失败，可能需要重新获取权限
      if (process.env.NODE_ENV === 'development') {
        console.warn('刷新sudo会话失败，可能需要重新输入密码:', error);
      }
      this.sudoSessionActive = false;
    }
  }

  /**
   * 获取合适的sudo命令前缀
   */
  private getSudoCommand(): string {
    // 检查是否为root用户
    if (process.getuid && process.getuid() === 0) {
      return '';
    }

    // 在Linux系统上使用图形化sudo工具
    if (process.platform === 'linux') {
      // 构建完整的环境变量，确保 PATH 包含常用的系统路径
      const currentPath = process.env.PATH || '';
      const additionalPaths = [
        '/usr/local/bin',
        '/usr/bin',
        '/bin',
        '/usr/sbin',
        '/sbin',
      ];

      // 确保所有常用路径都在 PATH 中
      const pathArray = currentPath.split(':');
      additionalPaths.forEach((path) => {
        if (!pathArray.includes(path)) {
          pathArray.push(path);
        }
      });
      const fullPath = pathArray.join(':');

      // 优先使用 pkexec（现代 Linux 桌面环境的标准）
      // 传递必要的环境变量，包括完整的 PATH
      return `pkexec env DISPLAY=$DISPLAY XAUTHORITY=$XAUTHORITY PATH="${fullPath}" `;
    }

    return '';
  }

  /**
   * 构建需要 root 权限的命令（优化版本，减少密码输入）
   */
  private buildRootCommand(
    scriptPath: string,
    useInputRedirection?: boolean,
    inputData?: string,
    envVars?: Record<string, string>,
  ): string {
    // 获取sudo命令前缀
    const sudoCommand = this.getSudoCommand();

    let command = '';

    // 给脚本添加执行权限
    command += `${sudoCommand}chmod +x "${scriptPath}"`;

    // 构建环境变量字符串
    let envString = '';
    if (envVars && Object.keys(envVars).length > 0) {
      const envPairs = Object.entries(envVars)
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ');
      envString = envPairs + ' ';
    }

    // 执行脚本
    if (useInputRedirection && inputData) {
      command += ` && ${sudoCommand}bash -c '${envString}echo "${inputData}" | bash "${scriptPath}"'`;
    } else {
      command += ` && ${sudoCommand}bash -c '${envString}bash "${scriptPath}"'`;
    }

    return command;
  }

  /**
   * 获取用户友好的错误消息
   */
  private getUserFriendlyErrorMessage(error: unknown, context: string): string {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // 网络相关错误
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('resolve') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('ENOTFOUND') ||
      errorMessage.includes('ECONNREFUSED')
    ) {
      return `${context}：网络连接失败，请检查网络连接和防火墙设置`;
    }

    // 权限相关错误
    if (
      errorMessage.includes('permission') ||
      errorMessage.includes('Access denied') ||
      errorMessage.includes('authentication') ||
      errorMessage.includes('EACCES')
    ) {
      return `${context}：权限不足，请确保具有管理员权限`;
    }

    // 文件不存在错误
    if (
      errorMessage.includes('ENOENT') ||
      errorMessage.includes('No such file') ||
      errorMessage.includes('not found')
    ) {
      return `${context}：所需文件或命令不存在，请检查安装是否完整`;
    }

    // 磁盘空间不足
    if (
      errorMessage.includes('ENOSPC') ||
      errorMessage.includes('No space left')
    ) {
      return `${context}：磁盘空间不足，请清理磁盘空间后重试`;
    }

    // 用户取消操作
    if (
      errorMessage.includes('cancelled') ||
      errorMessage.includes('aborted') ||
      errorMessage.includes('用户停止')
    ) {
      return `${context}：操作被用户取消`;
    }

    // Kubernetes相关错误
    if (
      errorMessage.includes('kubectl') ||
      errorMessage.includes('k3s') ||
      errorMessage.includes('cluster') ||
      errorMessage.includes('kubeconfig')
    ) {
      return `${context}：Kubernetes集群配置错误，请检查k3s服务状态`;
    }

    // 端口占用错误
    if (
      errorMessage.includes('port') &&
      errorMessage.includes('already in use')
    ) {
      return `${context}：端口被占用，请检查相关服务是否已在运行`;
    }

    // 默认返回原始错误消息，但添加上下文
    return `${context}：${errorMessage}`;
  }

  /**
   * 停止部署
   */
  async stopDeployment(): Promise<void> {
    try {
      // 如果有正在进行的部署流程，中断它
      if (this.abortController && !this.abortController.signal.aborted) {
        if (process.env.NODE_ENV === 'development') {
          console.log('正在停止部署流程...');
        }

        // 发送中断信号
        this.abortController.abort();
        if (process.env.NODE_ENV === 'development') {
          console.log('已发送中断信号给所有正在运行的进程');
        }

        // 等待一小段时间确保进程能够响应中断信号
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (process.env.NODE_ENV === 'development') {
          console.log('等待进程响应中断信号完成');
        }

        if (process.env.NODE_ENV === 'development') {
          console.log('部署流程已成功停止');
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log('没有正在进行的部署流程，直接更新为停止状态');
        }
      }

      // 统一更新为停止状态，不使用前端无法识别的 'stopping' 状态
      this.updateStatus({
        status: 'idle',
        message: '部署已停止',
        currentStep: 'stopped',
      });
    } catch (error) {
      console.error('停止部署时出错:', error);

      // 即使停止过程出错，也要更新状态
      this.updateStatus({
        status: 'idle',
        message: '部署已停止',
        currentStep: 'stopped',
      });
    } finally {
      // 清理资源
      if (process.env.NODE_ENV === 'development') {
        console.log('清理部署相关资源');
      }
      this.abortController = undefined;
      this.currentProcess = undefined;
    }
  }

  /**
   * 清理部署文件
   */
  async cleanup(): Promise<void> {
    if (fs.existsSync(this.deploymentPath)) {
      fs.rmSync(this.deploymentPath, { recursive: true, force: true });
    }
    this.updateStatus({
      status: 'idle',
      message: '清理完成',
      currentStep: 'idle',
    });
  }
}
