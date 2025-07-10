<template>
  <div class="container py-8 mx-auto">
    <div class="max-w-lg mx-auto">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div class="flex items-center justify-center mb-6">
          <div class="recording-indicator">
            <div class="recording-dot"></div>
          </div>
          <h1 class="text-2xl font-bold ml-4">
            {{ isRecording ? 'Recording...' : 'New Recording' }}
          </h1>
        </div>

        <div v-if="!isRecording" class="space-y-4">
          <ui-input
            v-model="workflowName"
            placeholder="Enter workflow name"
            label="Workflow Name"
            class="w-full"
          />
          
          <ui-textarea
            v-model="workflowDescription"
            placeholder="Enter workflow description (optional)"
            label="Description"
            class="w-full"
            :rows="3"
          />

          <ui-button
            @click="startRecording"
            variant="accent"
            class="w-full"
            :disabled="!workflowName.trim()"
          >
            <v-remixicon name="riRecordCircleLine" class="mr-2" />
            Start Recording
          </ui-button>
        </div>

        <div v-else class="space-y-4">
          <div class="bg-gray-100 dark:bg-gray-700 rounded p-4">
            <h3 class="font-semibold mb-2">Recording: {{ workflowName }}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-300">
              Navigate to a website and start interacting with it. Your actions will be recorded.
            </p>
          </div>

          <div class="recorded-actions">
            <h4 class="font-semibold mb-2">Recorded Actions ({{ recordedFlows.length }})</h4>
            <div class="space-y-2 max-h-60 overflow-y-auto">
              <div
                v-for="(flow, index) in recordedFlows"
                :key="index"
                class="flex items-center p-2 bg-gray-50 dark:bg-gray-700 rounded"
              >
                <v-remixicon :name="getFlowIcon(flow.id)" class="mr-2" />
                <span class="text-sm">{{ flow.description || flow.id }}</span>
              </div>
            </div>
          </div>

          <div class="flex space-x-2">
            <ui-button
              @click="stopRecording"
              variant="danger"
              class="flex-1"
            >
              <v-remixicon name="riStopCircleLine" class="mr-2" />
              Stop Recording
            </ui-button>
            
            <ui-button
              @click="saveRecording"
              variant="accent"
              class="flex-1"
              :disabled="recordedFlows.length === 0"
            >
              <v-remixicon name="riSaveLine" class="mr-2" />
              Save Workflow
            </ui-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import browser from 'webextension-polyfill';
import { sendMessage } from '@/utils/message';
import { useWorkflowStore } from '@/stores/workflow';

const router = useRouter();
const toast = useToast();
const workflowStore = useWorkflowStore();

const isRecording = ref(false);
const workflowName = ref('');
const workflowDescription = ref('');
const recordedFlows = ref([]);

let recordingCheckInterval = null;

const getFlowIcon = (flowId) => {
  const iconMap = {
    'event-click': 'riCursorLine',
    'forms': 'riInputMethodLine',
    'press-key': 'riKeyboardLine',
    'link': 'riLinkM',
    'element-scroll': 'riScrollToBottomLine',
    'trigger-event': 'riFocusLine',
    'upload-file': 'riUploadLine',
    'new-tab': 'riAddBoxLine',
    'switch-tab': 'riPagesLine'
  };
  return iconMap[flowId] || 'riQuestionLine';
};

const startRecording = async () => {
  try {
    // Get active tab
    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
    
    if (!activeTab || !activeTab.url.startsWith('http')) {
      toast.error('Please navigate to a website first');
      return;
    }

    // Initialize recording data
    await browser.storage.local.set({
      isRecording: true,
      recording: {
        name: workflowName.value,
        description: workflowDescription.value,
        flows: []
      }
    });

    // Inject recording script
    await sendMessage('inject:recordWorkflow', { tabId: activeTab.id }, 'background');
    
    isRecording.value = true;
    
    // Set badge to indicate recording
    await browser.action.setBadgeBackgroundColor({ color: '#ef4444' });
    await browser.action.setBadgeText({ text: 'rec' });
    
    // Start monitoring recording progress
    recordingCheckInterval = setInterval(checkRecordingProgress, 1000);
    
    toast.success('Recording started!');
  } catch (error) {
    console.error('Failed to start recording:', error);
    toast.error('Failed to start recording. Please try again.');
  }
};

const checkRecordingProgress = async () => {
  const { recording } = await browser.storage.local.get('recording');
  if (recording && recording.flows) {
    recordedFlows.value = recording.flows;
  }
};

const stopRecording = async () => {
  isRecording.value = false;
  
  if (recordingCheckInterval) {
    clearInterval(recordingCheckInterval);
    recordingCheckInterval = null;
  }
  
  await browser.storage.local.set({ isRecording: false });
  await browser.action.setBadgeText({ text: '' });
  
  // Send stop message to content script
  await sendMessage('recording:stop', null, 'background');
};

const saveRecording = async () => {
  try {
    const { recording } = await browser.storage.local.get('recording');
    
    if (!recording || recording.flows.length === 0) {
      toast.error('No actions recorded');
      return;
    }
    
    // Save recording as workflow
    const result = await sendMessage('recording:save', {
      recording,
      name: workflowName.value
    }, 'background');
    
    if (result.success) {
      toast.success('Workflow saved successfully!');
      
      // Clean up
      await browser.storage.local.remove(['recording', 'isRecording']);
      await browser.action.setBadgeText({ text: '' });
      
      // Navigate to the new workflow
      router.push(`/workflows/${result.workflowId}`);
    }
  } catch (error) {
    console.error('Failed to save recording:', error);
    toast.error('Failed to save workflow');
  }
};

onMounted(async () => {
  // Check if already recording
  const { isRecording: recordingActive, recording } = await browser.storage.local.get(['isRecording', 'recording']);
  
  if (recordingActive && recording) {
    isRecording.value = true;
    workflowName.value = recording.name || '';
    workflowDescription.value = recording.description || '';
    recordedFlows.value = recording.flows || [];
    
    // Resume monitoring
    recordingCheckInterval = setInterval(checkRecordingProgress, 1000);
  }
});

onBeforeUnmount(() => {
  if (recordingCheckInterval) {
    clearInterval(recordingCheckInterval);
  }
});
</script>

<style scoped>
.recording-indicator {
  @apply relative w-8 h-8;
}

.recording-dot {
  @apply absolute inset-0 bg-red-500 rounded-full;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.8);
  }
}

.recorded-actions {
  @apply border border-gray-200 dark:border-gray-600 rounded-lg p-4;
}
</style>