<!-- This is the modified Recording.vue file in Mime -->

<template>
  <div class="mx-auto w-full max-w-xl p-5">
    <div class="flex items-center">
      <button
        v-tooltip="t('recording.stop')"
        class="relative flex h-12 w-12 items-center justify-center rounded-full bg-red-400 focus:ring-0"
        @click="stopRecording"
      >
        <span
          class="absolute animate-ping rounded-full bg-red-400"
          style="height: 80%; width: 80%; animation-duration: 1.3s"
        ></span>
        <ui-spinner v-if="state.isGenerating" color="text-white" />
        <v-remixicon v-else name="riStopLine" class="relative z-10" />
      </button>
      <div class="ml-4 flex-1 overflow-hidden">
        <p class="text-sm">{{ t('recording.title') }}</p>
        <p class="text-overflow text-xl font-semibold leading-tight">
          {{ state.name }}
        </p>
      </div>
    </div>
    <p class="mt-6 mb-2 font-semibold">Flows</p>
    <ui-list class="space-y-1">
      <ui-list-item
        v-for="(item, index) in state.flows"
        :key="index"
        class="group"
        small
      >
        <v-remixicon :name="tasks[item.id].icon" />
        <div class="mx-2 flex-1 overflow-hidden">
          <p class="leading-tight">
            {{ t(`workflow.blocks.${item.id}.name`) }}
          </p>
          <p
            :title="item.data.description || item.description"
            class="text-overflow text-sm leading-tight text-gray-600 dark:text-gray-300"
          >
            {{ item.data.description || item.description }}
          </p>
        </div>
        <v-remixicon
          name="riDeleteBin7Line"
          class="invisible cursor-pointer group-hover:visible"
          @click="removeBlock(index)"
        />
      </ui-list-item>
    </ui-list>
  </div>
</template>
<script setup>
import { onMounted, reactive, toRaw, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { nanoid } from 'nanoid';
import defu from 'defu';
import browser from 'webextension-polyfill';
import { tasks } from '@/utils/shared';
import { useWorkflowStore } from '@/stores/workflow';
import RecordWorkflowUtils from '@/newtab/utils/RecordWorkflowUtils';

const browserEvents = {
  onTabCreated: (event) => RecordWorkflowUtils.onTabCreated(event),
  onTabsActivated: (event) => RecordWorkflowUtils.onTabsActivated(event),
  onCommitted: (event) => RecordWorkflowUtils.onWebNavigationCommited(event),
  onWebNavigationCompleted: (event) =>
    RecordWorkflowUtils.onWebNavigationCompleted(event),
};

const { t } = useI18n();
const router = useRouter();
const workflowStore = useWorkflowStore();

const state = reactive({
  name: '',
  flows: [],
  activeTab: {},
  isGenerating: false,
});

function generateDrawflow(startBlock, startBlockData) {
  let nextNodeId = nanoid();
  const triggerId = startBlock?.id || nanoid();
  let prevNodeId = startBlock?.id || triggerId;

  const nodes = [];
  const edges = [];

  const addEdge = (data = {}) => {
    edges.push({
      ...data,
      id: nanoid(),
      class: `source-${data.sourceHandle} targte-${data.targetHandle}`,
    });
  };
  addEdge({
    source: prevNodeId,
    target: nextNodeId,
    targetHandle: `${nextNodeId}-input-1`,
    sourceHandle: startBlock?.output || `${prevNodeId}-output-1`,
  });

  if (!startBlock) {
    nodes.push({
      position: {
        x: 50,
        y: 300,
      },
      id: triggerId,
      label: 'trigger',
      type: 'BlockBasic',
      data: tasks.trigger.data,
    });
  }

  const position = {
    y: startBlockData ? startBlockData.position.y + 120 : 300,
    x: startBlockData ? startBlockData.position.x + 280 : 320,
  };
  const groups = {};

  state.flows.forEach((block, index) => {
    if (block.groupId) {
      if (!groups[block.groupId]) groups[block.groupId] = [];

      groups[block.groupId].push({
        id: block.id,
        itemId: nanoid(),
        data: defu(block.data, tasks[block.id].data),
      });

      const nextNodeInGroup = state.flows[index + 1]?.groupId;
      if (nextNodeInGroup) return;

      block.id = 'blocks-group';
      block.data = { blocks: groups[block.groupId] };

      delete groups[block.groupId];
    }

    const node = {
      id: nextNodeId,
      label: block.id,
      type: tasks[block.id].component,
      data: defu(block.data, tasks[block.id].data),
      position: JSON.parse(JSON.stringify(position)),
    };

    prevNodeId = nextNodeId;
    nextNodeId = nanoid();

    if (index !== state.flows.length - 1) {
      addEdge({
        target: nextNodeId,
        source: prevNodeId,
        targetHandle: `${nextNodeId}-input-1`,
        sourceHandle: `${prevNodeId}-output-1`,
      });
    }

    const inNewRow = (index + 1) % 5 === 0;

    position.x = inNewRow ? 50 : position.x + 280;
    position.y = inNewRow ? position.y + 150 : position.y;

    nodes.push(node);
  });

  return {
    edges,
    nodes,
  };
}

async function stopRecording() {
  if (state.isGenerating) return;

  try {
    state.isGenerating = true;

    // Check if recording has parameters BEFORE saving
    const hasParameter = state.flows.some(flow => 
      flow.id === 'forms' && 
      flow.data?.value?.includes('{{parameter}}')
    );

    if (state.flows.length !== 0) {
      let savedWorkflowId = null;
      
      if (state.workflowId) {
        // UPDATE existing workflow
        const workflow = workflowStore.getById(state.workflowId);
        const startBlock = workflow.drawflow.nodes.find(
          (node) => node.id === state.connectFrom.id
        );
        const updatedDrawflow = generateDrawflow(state.connectFrom, startBlock);

        const drawflow = {
          ...workflow.drawflow,
          nodes: [...workflow.drawflow.nodes, ...updatedDrawflow.nodes],
          edges: [...workflow.drawflow.edges, ...updatedDrawflow.edges],
        };

        await workflowStore.update({
          id: state.workflowId,
          data: { drawflow },
        });
        
        savedWorkflowId = state.workflowId;
      } else {
        // CREATE new workflow
        const drawflow = generateDrawflow();

        const insertedWorkflows = await workflowStore.insert({
          drawflow,
          name: state.name,
          description: state.description ?? '',
        });
        
        // Get the ID of the newly created workflow
        savedWorkflowId = Object.keys(insertedWorkflows)[0];
      }

      // NEW CODE: Handle parameter and API save
      if (savedWorkflowId) {
        if (hasParameter) {
          // Use Vue's dialog system that's already imported
          const { useDialog } = await import('@/composable/dialog');
          const dialog = useDialog();
          
          dialog.prompt({
            title: 'Parameter Configuration',
            placeholder: 'Enter parameter name (e.g., "search query", "username")',
            okText: 'Save Command',
            onConfirm: async (parameterName) => {
              if (parameterName?.trim()) {
                // Save to API
                await saveCommandToAPI({
                  workflow_id: savedWorkflowId,
                  command_name: state.name,
                  has_parameter: true,
                  parameter_name: parameterName.trim()
                });
              }
              // Continue with navigation
              navigateAfterSave(savedWorkflowId);
            },
            onCancel: () => {
              // Still navigate even if cancelled
              navigateAfterSave(savedWorkflowId);
            }
          });
          
          // Don't navigate yet - wait for dialog
          return;
        } else {
          // No parameter - save and navigate
          await saveCommandToAPI({
            workflow_id: savedWorkflowId,
            command_name: state.name,
            has_parameter: false,
            parameter_name: null
          });
        }
        
        navigateAfterSave(savedWorkflowId);
      }
    } else {
      // No flows recorded
      navigateAfterSave(null);
    }
  } catch (error) {
    state.isGenerating = false;
    console.error(error);
  }
}

// NEW FUNCTION: Add this after stopRecording
async function navigateAfterSave(workflowId) {
  await browser.storage.local.remove(['isRecording', 'recording']);
  await (browser.action || browser.browserAction).setBadgeText({ text: '' });

  const tabs = (await browser.tabs.query({})).filter((tab) =>
    tab.url.startsWith('http')
  );
  Promise.allSettled(
    tabs.map(({ id }) =>
      browser.tabs.sendMessage(id, { type: 'recording:stop' })
    )
  );

  state.isGenerating = false;

  if (state.workflowId) {
    router.replace(
      `/workflows/${state.workflowId}?blockId=${state.connectFrom.id}`
    );
  } else if (workflowId) {
    router.replace(`/workflows/${workflowId}`);
  } else {
    router.replace('/');
  }
}

// REPLACE the saveCommandToAPI function
async function saveCommandToAPI(commandData) {
  try {
    // Get user ID from storage
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
    
    // Save command reference locally too
    const { savedCommands = [] } = await browser.storage.local.get('savedCommands');
    savedCommands.push({
      ...commandData,
      user_id: userId,
      api_id: result.id,
      created_at: Date.now()
    });
    await browser.storage.local.set({ savedCommands });
    
    // Show success notification
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    notification.textContent = 'Command saved successfully!';
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
    
    return result;
  } catch (error) {
    console.error('Failed to save command to API:', error);
    
    // Show error notification
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    notification.textContent = 'Failed to save command. Make sure the API server is running.';
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
    
    // Don't throw - let workflow save continue even if API fails
    return null;
  }
}

function removeBlock(index) {
  state.flows.splice(index, 1);

  browser.storage.local.set({ recording: toRaw(state) });
}
function onStorageChanged({ recording }) {
  if (!recording) return;

  Object.assign(state, recording.newValue);
}


onMounted(async () => {
  const { recording, isRecording } = await browser.storage.local.get([
    'recording',
    'isRecording',
  ]);

  if (!isRecording && !recording) return;

  window.stopRecording = stopRecording;

  // Add event listeners
  browser.storage.onChanged.addListener(onStorageChanged);
  browser.tabs.onCreated.addListener(browserEvents.onTabCreated);
  browser.tabs.onActivated.addListener(browserEvents.onTabsActivated);
  browser.webNavigation.onCommitted.addListener(browserEvents.onCommitted);
  browser.webNavigation.onCompleted.addListener(
    browserEvents.onWebNavigationCompleted
  );

  // Set the recording state
  Object.assign(state, recording);

  // Now inject the recording script into all active tabs
  try {
    const tabs = await browser.tabs.query({ url: 'http://*/*' });
    const httpsTab = await browser.tabs.query({ url: 'https://*/*' });
    const allTabs = [...tabs, ...httpsTab];
    
    console.log('Injecting recording script into', allTabs.length, 'tabs');
    
    // Inject recording script into all valid tabs
    for (const tab of allTabs) {
      try {
        // Check if content script exists first
        const exists = await browser.tabs.sendMessage(tab.id, {
          type: 'content-script-exists'
        }).catch(() => false);
        
        if (exists) {
          // Inject recording script directly since content script is available
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
          console.log('Recording script injected into tab:', tab.id);
        }
      } catch (error) {
        console.log('Could not inject into tab:', tab.id, error.message);
      }
    }
  } catch (error) {
    console.error('Error injecting recording scripts:', error);
  }
});

onBeforeUnmount(() => {
  window.stopRecording = null;
  browser.storage.local.onChanged.removeListener(onStorageChanged);
  browser.storage.onChanged.removeListener(onStorageChanged);
  browser.tabs.onCreated.removeListener(browserEvents.onTabCreated);
  browser.tabs.onActivated.removeListener(browserEvents.onTabsActivated);
  browser.webNavigation.onCommitted.removeListener(browserEvents.onCommitted);
  browser.webNavigation.onCompleted.removeListener(
    browserEvents.onWebNavigationCompleted
  );
});
</script>
