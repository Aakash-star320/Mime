<template>
  <div
    :class="[!showTab ? 'h-48' : 'h-56']"
    class="absolute top-0 left-0 w-full rounded-b-2xl bg-accent"
  ></div>
  <div
    :class="[!showTab ? 'mb-6' : 'mb-2']"
    class="dark relative z-10 px-5 pt-8 text-white placeholder:text-black"
  >
    <div class="mb-4 flex items-center">
      <h1 class="text-xl font-semibold text-white">Automa</h1>
      <div class="grow"></div>
      
      <!-- RECORDING BUTTON -->
      <ui-button
        v-if="!isRecording"
        v-tooltip.group="'Start Recording'"
        icon
        class="mr-2 recording-btn"
        @click="startRecording"
      >
        <v-remixicon name="riRecordCircleLine" class="text-red-400" />
      </ui-button>
      <ui-button
        v-else
        v-tooltip.group="'Stop Recording'"
        icon
        class="mr-2 recording-btn animate-pulse"
        @click="stopRecording"
      >
        <v-remixicon name="riStopCircleLine" class="text-red-400" />
      </ui-button>
      
      <ui-button
        v-tooltip.group="
          t(`home.elementSelector.${state.haveAccess ? 'name' : 'noAccess'}`)
        "
        icon
        class="mr-2"
        @click="initElementSelector"
      >
        <v-remixicon name="riFocus3Line" />
      </ui-button>
      <ui-button
        v-tooltip.group="t('common.dashboard')"
        icon
        :title="t('common.dashboard')"
        @click="openDashboard('')"
      >
        <v-remixicon name="riHome5Line" />
      </ui-button>
    </div>
    <div class="flex">
      <ui-input
        v-model="state.query"
        :placeholder="`${t('common.search')}...`"
        autocomplete="off"
        prepend-icon="riSearch2Line"
        class="search-input w-full"
      />
    </div>
    <ui-tabs
      v-if="showTab"
      v-model="state.activeTab"
      fill
      class="mt-1"
      @change="onTabChange"
    >
      <ui-tab value="local">
        {{ t(`home.workflow.type.local`) }}
      </ui-tab>
      <ui-tab v-if="hostedWorkflowStore.toArray.length > 0" value="host">
        {{ t(`home.workflow.type.host`) }}
      </ui-tab>
      <ui-tab v-if="userStore.user?.teams?.length" value="team"> Teams </ui-tab>
    </ui-tabs>
  </div>
  <home-team-workflows
    v-if="state.retrieved"
    v-show="state.activeTab === 'team'"
    :search="state.query"
  />
  <div
    v-if="state.activeTab !== 'team'"
    class="relative z-20 space-y-2 px-5 pb-5"
  >
    <ui-card v-if="workflowStore.getWorkflows.length === 0" class="text-center">
      <img src="@/assets/svg/alien.svg" />
      <p class="font-semibold">{{ t('message.empty') }}</p>
      <ui-button
        variant="accent"
        class="mt-6"
        @click="openDashboard('/workflows')"
      >
        {{ t('home.workflow.new') }}
      </ui-button>
    </ui-card>
    <div v-if="pinnedWorkflows.length > 0" class="mt-1 mb-4 border-b pb-4">
      <div class="mb-1 flex items-center text-gray-300">
        <v-remixicon name="riPushpin2Line" size="20" class="mr-2" />
        <span>Pinned workflows</span>
      </div>
      <home-workflow-card
        v-for="workflow in pinnedWorkflows"
        :key="workflow.id"
        :workflow="workflow"
        :tab="state.activeTab"
        :pinned="true"
        class="mb-2"
        @details="openWorkflowPage"
        @update="updateWorkflow(workflow.id, $event)"
        @execute="executeWorkflow"
        @rename="renameWorkflow"
        @delete="deleteWorkflow"
        @toggle-pin="togglePinWorkflow(workflow)"
      />
    </div>
    <div
      :class="{ 'p-2 rounded-lg bg-white': pinnedWorkflows.length === 0 }"
      class="flex items-center"
    >
      <ui-select v-model="state.activeFolder" class="flex-1">
        <option value="">Folder (all)</option>
        <option
          v-for="folder in folderStore.items"
          :key="folder.id"
          :value="folder.id"
        >
          {{ folder.name }}
        </option>
      </ui-select>
      <ui-popover class="ml-2">
        <template #trigger>
          <ui-button>
            <v-remixicon name="riSortDesc" class="mr-2 -ml-1" />
            <span>Sort</span>
          </ui-button>
        </template>
        <div class="w-48">
          <ui-select v-model="sortState.order" block placeholder="Sort order">
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </ui-select>
          <ui-select
            v-model="sortState.by"
            :placeholder="t('sort.sortBy')"
            block
            class="mt-2 flex-1"
          >
            <option v-for="sort in sorts" :key="sort" :value="sort">
              {{ t(`sort.${sort}`) }}
            </option>
          </ui-select>
        </div>
      </ui-popover>
    </div>
    <home-workflow-card
      v-for="workflow in workflows"
      :key="workflow.id"
      :workflow="workflow"
      :tab="state.activeTab"
      :pinned="state.pinnedWorkflows.includes(workflow.id)"
      @details="openWorkflowPage"
      @update="updateWorkflow(workflow.id, $event)"
      @execute="executeWorkflow"
      @rename="renameWorkflow"
      @delete="deleteWorkflow"
      @toggle-pin="togglePinWorkflow(workflow)"
    />
    <div
      v-if="state.showSettingsPopup"
      class="fixed bottom-5 left-0 m-4 rounded-lg bg-accent p-4 text-white shadow-md dark:text-black z-10"
    >
    <p class="text-sm leading-tight">
  If the workflow runs for less than 5 minutes, set it to run in the
  background in the
    
</p>
      <v-remixicon
        name="riCloseLine"
        class="absolute top-2 right-2 cursor-pointer text-gray-300 dark:text-gray-600"
        size="20"
        @click="closeSettingsPopup"
      />
    </div>
  </div>
</template>
<script setup>
import { nanoid } from 'nanoid';
import defu from 'defu';
import { tasks } from '@/utils/shared';
import BackgroundUtils from '@/background/BackgroundUtils';
import HomeTeamWorkflows from '@/components/popup/home/HomeTeamWorkflows.vue';
import HomeWorkflowCard from '@/components/popup/home/HomeWorkflowCard.vue';
import { useDialog } from '@/composable/dialog';
import { useGroupTooltip } from '@/composable/groupTooltip';
import { initElementSelector as initElementSelectorFunc } from '@/newtab/utils/elementSelector';
import RendererWorkflowService from '@/service/renderer/RendererWorkflowService';
import { useFolderStore } from '@/stores/folder';
import { useHostedWorkflowStore } from '@/stores/hostedWorkflow';
import { useTeamWorkflowStore } from '@/stores/teamWorkflow';
import { useUserStore } from '@/stores/user';
import { useWorkflowStore } from '@/stores/workflow';
import { arraySorter, parseJSON } from '@/utils/helper';
import { sendMessage } from '@/utils/message';
import automa from '@business';
import { computed, onMounted, shallowReactive, watch, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import browser from 'webextension-polyfill';

const isMV2 = browser.runtime.getManifest().manifest_version === 2;

const { t } = useI18n();
const dialog = useDialog();
const userStore = useUserStore();
const folderStore = useFolderStore();
const workflowStore = useWorkflowStore();
const teamWorkflowStore = useTeamWorkflowStore();
const hostedWorkflowStore = useHostedWorkflowStore();

async function saveRecordingAsWorkflow(recording) {
  try {
    const { nanoid } = await import('nanoid');
    const { tasks } = await import('@/utils/shared');
    const defu = (await import('defu')).default;
    
    // Generate workflow structure (similar to Recording.vue logic)
    let nextNodeId = nanoid();
    const triggerId = nanoid();
    let prevNodeId = triggerId;

    const nodes = [];
    const edges = [];

    const addEdge = (data = {}) => {
      edges.push({
        ...data,
        id: nanoid(),
        class: `source-${data.sourceHandle} target-${data.targetHandle}`,
      });
    };

    // Add trigger node
    nodes.push({
      position: { x: 252, y: 68 },
      id: triggerId,
      label: 'trigger',
      type: 'BlockBasic',
      data: tasks.trigger.data,
    });

    // Add active-tab node
    const activeTabId = nanoid();
    nodes.push({
      position: { x: 252, y: 188 },
      id: activeTabId,
      label: 'active-tab',
      type: 'BlockBasic',
      data: tasks['active-tab'].data,
    });

    // Edge from trigger to active-tab
    addEdge({
      source: triggerId,
      target: activeTabId,
      targetHandle: `${activeTabId}-input-1`,
      sourceHandle: `${triggerId}-output-1`,
    });

    prevNodeId = activeTabId;
    let yPosition = 308;

    // Process recorded flows
    const groups = {};
    
    recording.flows.forEach((block, index) => {
      if (block.groupId) {
        if (!groups[block.groupId]) groups[block.groupId] = [];

        groups[block.groupId].push({
          id: block.id,
          itemId: nanoid(),
          data: defu(block.data, tasks[block.id].data),
        });

        const nextNodeInGroup = recording.flows[index + 1]?.groupId;
        if (nextNodeInGroup) return;

        block.id = 'blocks-group';
        block.data = { blocks: groups[block.groupId] };
        delete groups[block.groupId];
      }

      const nodeId = nanoid();
      const node = {
        id: nodeId,
        label: block.id,
        type: tasks[block.id].component,
        data: defu(block.data, tasks[block.id].data),
        position: { x: 252, y: yPosition },
      };

      addEdge({
        source: prevNodeId,
        target: nodeId,
        targetHandle: `${nodeId}-input-1`,
        sourceHandle: `${prevNodeId}-output-1`,
      });

      prevNodeId = nodeId;
      yPosition += 120;
      nodes.push(node);
    });

    // Create workflow
    const workflowData = {
      name: recording.name,
      description: recording.description || '',
      drawflow: {
        nodes,
        edges,
        position: [0, 0],
        zoom: 1.3,
        viewport: { x: 0, y: 0, zoom: 1.3 }
      },
      table: [],
      dataColumns: [],
      settings: {
        publicId: '',
        blockDelay: 0,
        saveLog: true,
        debugMode: false,
        notification: true,
        execContext: 'popup',
        reuseLastState: false,
        onError: 'stop-workflow',
        tabLoadTimeout: 30000,
        executedBlockOnWeb: false
      },
      createdAt: Date.now(),
      isDisabled: false
    };

    // Save workflow
    const insertedWorkflows = await workflowStore.insert(workflowData);
    const workflowId = Object.keys(insertedWorkflows)[0];
    
    console.log('Workflow saved with ID:', workflowId);
    return workflowId;
    
  } catch (error) {
    console.error('Failed to save workflow:', error);
    throw error;
  }
}

// Helper function to save command to API
async function saveCommandToAPI(commandData) {
  try {
    const { user } = await browser.storage.local.get('user');
    const userId = user?.id || 'default_user';
    
    console.log('Saving command to API:', commandData);
    
    const response = await fetch('http://localhost:8000/save-command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        command_name: commandData.command_name,
        has_parameter: commandData.has_parameter,
        parameter_name: commandData.parameter_name,
        workflow_id: commandData.workflow_id
      }),
    });
    
    const result = await response.json();
    
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to save command');
    }
    
    console.log('Command saved successfully:', result);
    return result;
  } catch (error) {
    console.error('Failed to save command to API:', error);
    // Don't throw - let workflow save continue even if API fails
    return null;
  }
}

useGroupTooltip();

const sorts = ['name', 'createdAt', 'updatedAt', 'mostUsed'];
const savedSorts =
  parseJSON(localStorage.getItem('popup-workflow-sort'), {}) || {};

const sortState = shallowReactive({
  by: savedSorts.sortBy || 'createdAt',
  order: savedSorts.sortOrder || 'desc',
});
const state = shallowReactive({
  query: '',
  teams: [],
  cardHeight: 255,
  retrieved: false,
  haveAccess: true,
  activeTab: 'local',
  pinnedWorkflows: [],
  activeFolder: savedSorts.activeFolder,
  showSettingsPopup: isMV2
    ? false
    : parseJSON(localStorage.getItem('settingsPopup'), true) ?? true,
});

const isRecording = ref(false);

const pinnedWorkflows = computed(() => {
  if (state.activeTab !== 'local') return [];

  const list = [];
  state.pinnedWorkflows.forEach((workflowId) => {
    const workflow = workflowStore.getById(workflowId);
    if (
      !workflow ||
      !workflow.name
        .toLocaleLowerCase()
        .includes(state.query.toLocaleLowerCase())
    )
      return;

    list.push(workflow);
  });

  return list;
});
const hostedWorkflows = computed(() => {
  if (state.activeTab !== 'host') return [];

  return hostedWorkflowStore.toArray.filter((workflow) =>
    workflow.name.toLocaleLowerCase().includes(state.query.toLocaleLowerCase())
  );
});
const localWorkflows = computed(() => {
  if (state.activeTab !== 'local') return [];

  const filteredLocalWorkflows = workflowStore.getWorkflows.filter(
    ({ name, folderId }) => {
      const isInFolder = !state.activeFolder || state.activeFolder === folderId;
      const nameMatch = name
        .toLocaleLowerCase()
        .includes(state.query.toLocaleLowerCase());

      return isInFolder && nameMatch;
    }
  );

  return arraySorter({
    key: sortState.by,
    order: sortState.order,
    data: filteredLocalWorkflows,
  });
});
const workflows = computed(() =>
  state.activeTab === 'local' ? localWorkflows.value : hostedWorkflows.value
);
const showTab = computed(
  () =>
    hostedWorkflowStore.toArray.length > 0 || userStore.user?.teams?.length > 0
);

function openDocs() {
  window.open(
    'https://docs.automa.site/guide/quick-start.html#recording-actions',
    '_blank'
  );
}
function closeSettingsPopup() {
  state.showSettingsPopup = false;
  localStorage.setItem('settingsPopup', false);
}
function togglePinWorkflow(workflow) {
  const index = state.pinnedWorkflows.indexOf(workflow.id);
  const copyData = [...state.pinnedWorkflows];

  if (index === -1) {
    copyData.push(workflow.id);
  } else {
    copyData.splice(index, 1);
  }

  state.pinnedWorkflows = copyData;
  browser.storage.local.set({
    pinnedWorkflows: copyData,
  });
}
async function executeWorkflow(workflow) {
  try {
    await RendererWorkflowService.executeWorkflow(workflow, workflow.options);
    window.close();
  } catch (error) {
    console.error(error);
  }
}
function updateWorkflow(id, data) {
  return workflowStore.update({
    id,
    data,
  });
}
function renameWorkflow({ id, name }) {
  dialog.prompt({
    title: t('home.workflow.rename'),
    placeholder: t('common.name'),
    okText: t('common.rename'),
    inputValue: name,
    onConfirm: (newName) => {
      updateWorkflow(id, { name: newName });
    },
  });
}
function deleteWorkflow({ id, hostId, name }) {
  dialog.confirm({
    title: t('home.workflow.delete'),
    okVariant: 'danger',
    body: t('message.delete', { name }),
    onConfirm: () => {
      if (state.activeTab === 'local') {
        workflowStore.delete(id);
      } else {
        hostedWorkflowStore.delete(hostId);
      }
    },
  });
}
function openDashboard(url) {
  BackgroundUtils.openDashboard(url);
}
async function initElementSelector() {
  const [tab] = await browser.tabs.query({
    url: '*://*/*',
    active: true,
    currentWindow: true,
  });
  if (!tab) return;
  initElementSelectorFunc(tab).then(() => {
    window.close();
  });
}
function openWorkflowPage({ id, hostId }) {
  let url = `/workflows/${id}`;

  if (state.activeTab === 'host') {
    url = `/workflows/${hostId}/host`;
  }

  openDashboard(url);
}
function onTabChange(value) {
  localStorage.setItem('popup-tab', value);
}

const startRecording = async () => {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      dialog.confirm({
        title: 'No Active Tab',
        body: 'Please open a webpage first before starting recording.',
        onlyOk: true,
      });
      return;
    }
    
    // Check if it's a valid URL
    if (!tab.url || !tab.url.startsWith('http')) {
      dialog.confirm({
        title: 'Invalid Page',
        body: 'Recording only works on web pages (http/https).',
        onlyOk: true,
      });
      return;
    }
    
    // Prompt for workflow name
    dialog.prompt({
      title: t('recording.title') || 'New Recording',
      placeholder: t('common.name') || 'Workflow name',
      okText: t('common.start') || 'Start Recording',
      inputValue: 'New Recording',
      onConfirm: async (workflowName) => {
        if (!workflowName.trim()) {
          dialog.confirm({
            title: 'Name Required',
            body: 'Please enter a workflow name.',
            onlyOk: true,
          });
          return;
        }
        
        try {
          // Step 1: Inject content script if needed
          let contentScriptReady = false;
          try {
            contentScriptReady = await browser.tabs.sendMessage(tab.id, {
              type: 'content-script-exists'
            });
          } catch (error) {
            console.log('Content script not ready, injecting...');
          }
          
          if (!contentScriptReady) {
            if (browser.scripting) {
              await browser.scripting.executeScript({
                target: { tabId: tab.id, allFrames: true },
                files: ['contentScript.bundle.js']
              });
            } else {
              await browser.tabs.executeScript(tab.id, {
                file: 'contentScript.bundle.js',
                allFrames: true
              });
            }
            
            // Wait for content script to initialize
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          // Step 2: Set recording state
          await browser.storage.local.set({ 
            isRecording: true,
            recording: { 
              flows: [], 
              name: workflowName,
              description: ''
            }
          });
          
          // Step 3: Inject recording script into current tab
          if (browser.scripting) {
            await browser.scripting.executeScript({
              target: { tabId: tab.id, allFrames: true },
              files: ['recordWorkflow.bundle.js']
            });
          } else {
            await browser.tabs.executeScript(tab.id, {
              file: 'recordWorkflow.bundle.js',
              allFrames: true
            });
          }
          
          // Step 4: Set UI state and badge
          isRecording.value = true;
          
          await (browser.action || browser.browserAction).setBadgeBackgroundColor({
            color: '#ef4444',
          });
          await (browser.action || browser.browserAction).setBadgeText({
            text: 'rec',
          });
          
          console.log('Recording started successfully');
          
          // Don't close popup, let user see recording status
          
        } catch (error) {
          console.error('Failed to start recording:', error);
          
          // Reset state on error
          await browser.storage.local.remove(['isRecording', 'recording']);
          isRecording.value = false;
          
          dialog.confirm({
            title: 'Recording Failed',
            body: `Failed to start recording: ${error.message}`,
            onlyOk: true,
            okVariant: 'danger',
          });
        }
      },
    });
  } catch (error) {
    console.error('Failed to start recording:', error);
  }
};

const stopRecording = async () => {
  try {
    // Get current recording data
    const { recording } = await browser.storage.local.get('recording');
    
    if (!recording) {
      console.log('No recording data found');
      isRecording.value = false;
      return;
    }
    
    // Stop recording immediately
    await browser.storage.local.remove(['isRecording', 'recording']);
    await (browser.action || browser.browserAction).setBadgeText({ text: '' });
    
    // Update UI state
    isRecording.value = false;
    
    // Send stop message to all tabs to clean up recording scripts
    const tabs = await browser.tabs.query({});
    const httpTabs = tabs.filter(tab => tab.url && tab.url.startsWith('http'));
    
    await Promise.allSettled(
      httpTabs.map(tab => 
        browser.tabs.sendMessage(tab.id, { type: 'recording:stop' })
          .catch(error => console.log('Tab cleanup failed:', tab.id, error.message))
      )
    );
    
    // If there are recorded flows, save as workflow
    if (recording.flows && recording.flows.length > 0) {
      // Check if recording has parameters
      const hasParameter = recording.flows.some(flow => 
        flow.id === 'forms' && 
        flow.data?.value?.includes('{{parameter}}')
      );
      
      // Generate workflow
      const workflowId = await saveRecordingAsWorkflow(recording);
      
      if (hasParameter && workflowId) {
        // Prompt for parameter name
        dialog.prompt({
          title: 'Parameter Configuration',
          placeholder: 'Enter parameter name (e.g., "search query", "username")',
          okText: 'Save Command',
          onConfirm: async (parameterName) => {
            if (parameterName?.trim()) {
              // Save to API
              await saveCommandToAPI({
                workflow_id: workflowId,
                command_name: recording.name,
                has_parameter: true,
                parameter_name: parameterName.trim()
              });
            }
            
            // Show success message
            dialog.confirm({
              title: 'Recording Saved',
              body: `Workflow "${recording.name}" has been saved successfully!`,
              onlyOk: true,
            });
          },
          onCancel: () => {
            dialog.confirm({
              title: 'Recording Saved',
              body: `Workflow "${recording.name}" has been saved successfully!`,
              onlyOk: true,
            });
          }
        });
      } else {
        // No parameter - just save
        if (workflowId) {
          await saveCommandToAPI({
            workflow_id: workflowId,
            command_name: recording.name,
            has_parameter: false,
            parameter_name: null
          });
        }
        
        dialog.confirm({
          title: 'Recording Saved',
          body: `Workflow "${recording.name}" has been saved successfully!`,
          onlyOk: true,
        });
      }
    } else {
      // No flows recorded
      dialog.confirm({
        title: 'Recording Stopped',
        body: 'Recording stopped. No actions were recorded.',
        onlyOk: true,
      });
    }
    
    console.log('Recording stopped successfully');
    
  } catch (error) {
    console.error('Failed to stop recording:', error);
    isRecording.value = false;
    
    dialog.confirm({
      title: 'Error',
      body: `Failed to stop recording: ${error.message}`,
      onlyOk: true,
      okVariant: 'danger',
    });
  }
};

watch(
  () => [sortState.by, sortState.order, state.activeFolder],
  ([sortBy, sortOrder, activeFolder]) => {
    localStorage.setItem(
      'popup-workflow-sort',
      JSON.stringify({ sortOrder, sortBy, activeFolder })
    );
  }
);

// Add this to your Home.vue onMounted function - IMPROVED recording state check

onMounted(async () => {
  try {
    // Check recording state FIRST
    const { isRecording: recording } = await browser.storage.local.get('isRecording');
    console.log('Current recording state:', recording);
    
    isRecording.value = recording || false;
    
    // If recording is active, check if recording page is already open
    if (isRecording.value) {
      const tabs = await browser.tabs.query({
        url: browser.runtime.getURL('/newtab.html')
      });
      
      const recordingTab = tabs.find(tab => tab.url.includes('#/recording') || tab.url.includes('/recording'));
      
      if (recordingTab) {
        // Recording page is already open, just focus it
        await browser.tabs.update(recordingTab.id, { active: true });
        await browser.windows.update(recordingTab.windowId, { focused: true });
      } else {
        // Open recording page
        await sendMessage('open:dashboard', '/recording', 'background');
      }
      
      window.close();
      return;
    }
    
    // Rest of your existing onMounted code...
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    state.haveAccess = /^(https?)/.test(tab?.url || '');

    const storage = await browser.storage.local.get('pinnedWorkflows');
    state.pinnedWorkflows = storage.pinnedWorkflows || [];

    await folderStore.load();
    await userStore.loadUser({ storage: localStorage, ttl: 1000 * 60 * 5 });
    await teamWorkflowStore.loadData();

    let activeTab = localStorage.getItem('popup-tab') || 'local';

    await automa('app');

    if (activeTab === 'team' && !userStore.user?.teams) activeTab = 'local';
    else if (activeTab === 'host' && hostedWorkflowStore.toArray.length < 1)
      activeTab = 'local';

    state.retrieved = true;
    state.activeTab = activeTab;

    if (state.activeFolder) {
      const folderExist = folderStore.items.some(
        (folder) => folder.id === state.activeFolder
      );
      if (!folderExist) state.activeFolder = '';
    }
  } catch (error) {
    console.error('Error in onMounted:', error);
    state.retrieved = true;
  }
});

</script>
<style>
.recording-card {
  transition: height 300ms cubic-bezier(0.4, 0, 0.2, 1) !important;
}

/* Recording button styles */
.recording-btn:hover {
  background-color: rgba(239, 68, 68, 0.1) !important;
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>