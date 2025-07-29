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
      
      <!-- VOICE RECORDING BUTTON -->
      <ui-button
        v-if="!isVoiceRecording"
        v-tooltip.group="'Start Voice Command'"
        icon
        class="mr-2 voice-btn"
        @click="startVoiceRecording"
        :disabled="isRecording || isProcessingVoice"
      >
        <v-remixicon name="riMicLine" class="text-blue-400" />
      </ui-button>
      <ui-button
        v-else
        v-tooltip.group="'Stop Voice Recording'"
        icon
        class="mr-2 voice-btn recording-pulse"
        @click="stopVoiceRecording"
        :disabled="isProcessingVoice"
      >
        <v-remixicon name="riMicFill" class="text-red-500" />
      </ui-button>
      
      <!-- RECORDING BUTTON -->
      <ui-button
        v-if="!isRecording"
        v-tooltip.group="'Start Recording'"
        icon
        class="mr-2 recording-btn"
        @click="startRecording"
        :disabled="isVoiceRecording || isProcessingVoice"
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
    
    <!-- Voice Recording Status - ALWAYS VISIBLE WHEN ACTIVE -->
    <div v-if="isVoiceRecording || isProcessingVoice" class="mb-2">
      <div class="bg-blue-500/30 border border-blue-400 rounded-lg p-3 text-center">
        <div v-if="isVoiceRecording" class="flex items-center justify-center">
          <div class="voice-indicator mr-2"></div>
          <span class="text-sm font-semibold">🎙️ LISTENING - Speak now...</span>
        </div>
        <div v-else-if="isProcessingVoice" class="flex items-center justify-center">
          <ui-spinner size="16" class="mr-2" />
          <span class="text-sm font-semibold">🔄 PROCESSING voice command...</span>
        </div>
      </div>
    </div>
    
    <!-- Voice Command Result -->
    <div v-if="lastVoiceResult" class="mb-2">
      <div :class="voiceResultClass" class="rounded-lg p-3 text-center border">
        <div class="flex items-center justify-center">
          <v-remixicon 
            :name="lastVoiceResult.success ? 'riCheckLine' : 'riCloseLine'" 
            class="mr-2" 
            size="16"
          />
          <span class="text-sm font-semibold">{{ lastVoiceResult.message }}</span>
        </div>
        <div v-if="lastVoiceResult.transcribed_text" class="text-xs mt-2 opacity-90 font-mono">
          📝 "{{ lastVoiceResult.transcribed_text }}"
        </div>
        <div v-if="lastVoiceResult.success && lastVoiceResult.parameter" class="text-xs mt-1 opacity-90">
          🎯 Parameter: {{ lastVoiceResult.parameter }}
        </div>
      </div>
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
import { computed, onMounted, shallowReactive, watch, ref, onUnmounted } from 'vue';
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

// Voice recording state - FIXED VARIABLES
const isVoiceRecording = ref(false);
const isProcessingVoice = ref(false);
const lastVoiceResult = ref(null);

// GLOBAL VARIABLES - DO NOT RECREATE
let currentMediaStream = null;
let currentMediaRecorder = null;
let audioChunks = [];

const voiceResultClass = computed(() => {
  if (!lastVoiceResult.value) return '';
  return lastVoiceResult.value.success 
    ? 'bg-green-500/20 text-green-300 border-green-400'
    : 'bg-red-500/20 text-red-300 border-red-400';
});

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

// FIXED Voice recording functions
// Voice recording functions - COMPLETELY REWRITTEN
const startVoiceRecording = async () => {
  console.log('🎙️ [Voice] === STARTING VOICE RECORDING ===');
  
  try {
    // Check if already recording
    if (isVoiceRecording.value) {
      console.log('🎙️ [Voice] Already recording, stopping current session first...');
      cleanupVoiceRecording();
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
    }
    
    // Clear any previous results
    lastVoiceResult.value = null;
    isProcessingVoice.value = false;
    
    console.log('🎙️ [Voice] Requesting microphone access...');
    
    // Request microphone with more specific constraints
    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: { ideal: 16000 },
        channelCount: { ideal: 1 },
        sampleSize: { ideal: 16 }
      }
    };
    
    currentMediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('🎙️ [Voice] ✅ Microphone access granted');
    
    // Verify stream is active
    const tracks = currentMediaStream.getAudioTracks();
    console.log('🎙️ [Voice] Audio tracks:', tracks.length);
    
    if (tracks.length === 0) {
      throw new Error('No audio tracks available');
    }
    
    const track = tracks[0];
    console.log('🎙️ [Voice] Track state:', track.readyState);
    console.log('🎙️ [Voice] Track enabled:', track.enabled);
    
    if (track.readyState !== 'live') {
      throw new Error('Audio track is not live');
    }
    
    // Reset audio chunks
    audioChunks = [];
    
    // Find the best supported MIME type
    let selectedMimeType = null;
    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/wav'
    ];
    
    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        selectedMimeType = mimeType;
        console.log('🎙️ [Voice] Selected MIME type:', mimeType);
        break;
      }
    }
    
    if (!selectedMimeType) {
      throw new Error('No supported audio MIME types found');
    }
    
    // Create MediaRecorder with error handling
    try {
      currentMediaRecorder = new MediaRecorder(currentMediaStream, {
        mimeType: selectedMimeType,
        audioBitsPerSecond: 128000
      });
    } catch (err) {
      console.error('🎙️ [Voice] Failed to create MediaRecorder:', err);
      // Try without specific settings
      currentMediaRecorder = new MediaRecorder(currentMediaStream);
      selectedMimeType = 'audio/webm'; // fallback
    }
    
    console.log('🎙️ [Voice] MediaRecorder created successfully');
    
    // Set up ALL event handlers BEFORE starting
    currentMediaRecorder.ondataavailable = (event) => {
      console.log('🎙️ [Voice] 📦 Data chunk received:', event.data.size, 'bytes');
      if (event.data && event.data.size > 0) {
        audioChunks.push(event.data);
        console.log('🎙️ [Voice] Total chunks:', audioChunks.length);
      }
    };
    
    currentMediaRecorder.onstart = () => {
      console.log('🎙️ [Voice] ✅ MediaRecorder STARTED successfully');
      // Set recording state ONLY after successful start
      isVoiceRecording.value = true;
    };
    
    currentMediaRecorder.onstop = async () => {
      console.log('🎙️ [Voice] 📍 MediaRecorder STOPPED');
      console.log('🎙️ [Voice] Total audio chunks collected:', audioChunks.length);
      
      // Don't set isVoiceRecording to false here - let stopVoiceRecording handle it
      isProcessingVoice.value = true;
      
      try {
        if (audioChunks.length === 0) {
          throw new Error('No audio data was recorded');
        }
        
        // Calculate total size
        const totalSize = audioChunks.reduce((total, chunk) => total + chunk.size, 0);
        console.log('🎙️ [Voice] Total audio size:', totalSize, 'bytes');
        
        if (totalSize < 1000) {
          throw new Error('Audio data too small (less than 1KB)');
        }
        
        // Create audio blob
        const audioBlob = new Blob(audioChunks, { type: selectedMimeType });
        console.log('🎙️ [Voice] Created audio blob:', audioBlob.size, 'bytes, type:', audioBlob.type);
        
        // Process the audio
        await processVoiceCommand(audioBlob);
        
      } catch (error) {
        console.error('🎙️ [Voice] ❌ Error in onstop handler:', error);
        lastVoiceResult.value = {
          success: false,
          message: `Recording failed: ${error.message}`,
          transcribed_text: ''
        };
      } finally {
        isProcessingVoice.value = false;
        cleanupVoiceRecording();
      }
    };
    
    currentMediaRecorder.onerror = (event) => {
      console.error('🎙️ [Voice] ❌ MediaRecorder ERROR:', event.error);
      lastVoiceResult.value = {
        success: false,
        message: `Recording error: ${event.error?.name || 'Unknown error'}`,
        transcribed_text: ''
      };
      cleanupVoiceRecording();
    };
    
    currentMediaRecorder.onpause = () => {
      console.log('🎙️ [Voice] MediaRecorder PAUSED');
    };
    
    currentMediaRecorder.onresume = () => {
      console.log('🎙️ [Voice] MediaRecorder RESUMED');
    };
    
    // Start recording with time slice for regular data collection
    console.log('🎙️ [Voice] Starting MediaRecorder with 1000ms time slice...');
    currentMediaRecorder.start(1000);
    
    // Verify it started
    setTimeout(() => {
      if (currentMediaRecorder && currentMediaRecorder.state === 'recording') {
        console.log('🎙️ [Voice] ✅ Recording state verified as active');
      } else {
        console.error('🎙️ [Voice] ❌ Recording failed to start properly');
        console.error('🎙️ [Voice] MediaRecorder state:', currentMediaRecorder?.state);
        cleanupVoiceRecording();
      }
    }, 100);
    
  } catch (error) {
    console.error('🎙️ [Voice] ❌ CRITICAL ERROR in startVoiceRecording:', error);
    console.error('🎙️ [Voice] Error name:', error.name);
    console.error('🎙️ [Voice] Error message:', error.message);
    
    cleanupVoiceRecording();
    
    let errorMessage = 'Failed to start voice recording';
    let errorTitle = 'Recording Failed';
    
    if (error.name === 'NotAllowedError') {
      errorTitle = 'Microphone Permission Denied';
      errorMessage = 'Please allow microphone access in your browser settings and try again.';
    } else if (error.name === 'NotFoundError') {
      errorTitle = 'No Microphone Found';
      errorMessage = 'No microphone device was detected. Please connect a microphone and try again.';
    } else if (error.name === 'NotSupportedError') {
      errorTitle = 'Browser Not Supported';
      errorMessage = 'Your browser does not support voice recording. Please try a different browser.';
    } else if (error.name === 'NotReadableError') {
      errorTitle = 'Microphone Busy';
      errorMessage = 'Your microphone is being used by another application. Please close other apps and try again.';
    }
    
    dialog.confirm({
      title: errorTitle,
      body: errorMessage,
      onlyOk: true,
      okVariant: 'danger'
    });
  }
};

const stopVoiceRecording = () => {
  console.log('🎙️ [Voice] === STOPPING VOICE RECORDING ===');
  
  if (!isVoiceRecording.value) {
    console.log('🎙️ [Voice] ⚠️ Not currently recording, ignoring stop request');
    return;
  }
  
  // Set recording state to false IMMEDIATELY to prevent double-clicks
  isVoiceRecording.value = false;
  console.log('🎙️ [Voice] Set isVoiceRecording to FALSE');
  
  if (currentMediaRecorder) {
    console.log('🎙️ [Voice] MediaRecorder state:', currentMediaRecorder.state);
    
    if (currentMediaRecorder.state === 'recording') {
      console.log('🎙️ [Voice] Stopping MediaRecorder...');
      currentMediaRecorder.stop();
    } else if (currentMediaRecorder.state === 'paused') {
      console.log('🎙️ [Voice] Resuming and stopping MediaRecorder...');
      currentMediaRecorder.resume();
      currentMediaRecorder.stop();
    } else {
      console.log('🎙️ [Voice] MediaRecorder not in recording state, cleaning up...');
      cleanupVoiceRecording();
    }
  } else {
    console.warn('🎙️ [Voice] No MediaRecorder available to stop');
    cleanupVoiceRecording();
  }
};

// Enhanced cleanup function
const cleanupVoiceRecording = () => {
  console.log('🎙️ [Voice] === CLEANUP STARTING ===');
  
  // Reset states first
  isVoiceRecording.value = false;
  isProcessingVoice.value = false;
  
  // Stop and clean up media stream
  if (currentMediaStream) {
    console.log('🎙️ [Voice] Stopping media stream tracks...');
    currentMediaStream.getTracks().forEach((track, index) => {
      console.log(`🎙️ [Voice] Stopping track ${index}:`, track.kind, track.label);
      track.stop();
    });
    currentMediaStream = null;
    console.log('🎙️ [Voice] Media stream cleaned up');
  }
  
  // Clean up MediaRecorder
  if (currentMediaRecorder) {
    console.log('🎙️ [Voice] Cleaning up MediaRecorder...');
    
    // Remove event listeners to prevent memory leaks
    currentMediaRecorder.ondataavailable = null;
    currentMediaRecorder.onstop = null;
    currentMediaRecorder.onerror = null;
    currentMediaRecorder.onstart = null;
    
    currentMediaRecorder = null;
    console.log('🎙️ [Voice] MediaRecorder cleaned up');
  }
  
  // Clear audio chunks
  audioChunks = [];
  console.log('🎙️ [Voice] Audio chunks cleared');
  
  console.log('🎙️ [Voice] === CLEANUP COMPLETE ===');
};

const processVoiceCommand = async (audioBlob) => {
  console.log('🔊 [Voice] === PROCESSING VOICE COMMAND ===');
  console.log('🔊 [Voice] Audio blob details:', {
    size: audioBlob.size,
    type: audioBlob.type
  });
  
  try {
    // Get user ID
    const { user } = await browser.storage.local.get('user');
    const userId = user?.id || 'default_user';
    console.log('🔊 [Voice] User ID:', userId);
    
    // Create FormData
    const formData = new FormData();
    formData.append('audio', audioBlob, 'voice-command.webm');
    formData.append('user_id', userId);
    
    console.log('📤 [Voice] Sending to server at http://localhost:8000/voice-command...');
    console.log('📤 [Voice] FormData contents:');
    for (let [key, value] of formData.entries()) {
      if (key === 'audio') {
        console.log(`📤 [Voice] ${key}:`, value.size, 'bytes,', value.type);
      } else {
        console.log(`📤 [Voice] ${key}:`, value);
      }
    }
    
    // Send to server with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const response = await fetch('http://localhost:8000/voice-command', {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    console.log('📥 [Voice] Server response status:', response.status);
    console.log('📥 [Voice] Server response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('📥 [Voice] Server error response:', errorText);
      throw new Error(`Server error ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    console.log('📥 [Voice] Server response data:', result);
    
    lastVoiceResult.value = result;
    
    // Auto-hide result after 15 seconds
    setTimeout(() => {
      if (lastVoiceResult.value === result) {
        lastVoiceResult.value = null;
      }
    }, 15000);
    
    // Execute workflow if successful
    if (result.success && result.workflow_id) {
      console.log('✅ [Voice] Command matched! Executing workflow:', result.workflow_id);
      
      const workflow = workflowStore.getById(result.workflow_id);
      if (workflow) {
        console.log('✅ [Voice] Found workflow:', workflow.name);
        
        let workflowToExecute = JSON.parse(JSON.stringify(workflow));
        
        // Replace parameters
        if (result.parameter) {
          console.log('🔧 [Voice] Replacing parameter:', result.parameter);
          
          if (workflowToExecute.drawflow?.nodes) {
            let replacementCount = 0;
            workflowToExecute.drawflow.nodes.forEach(node => {
              if (node.label === 'forms' && node.data?.value) {
                if (node.data.value.includes('{{parameter}}')) {
                  console.log(`🔧 [Voice] Before: ${node.data.value}`);
                  node.data.value = node.data.value.replace(/\{\{parameter\}\}/g, result.parameter);
                  console.log(`🔧 [Voice] After: ${node.data.value}`);
                  replacementCount++;
                }
              }
            });
            console.log(`🔧 [Voice] Made ${replacementCount} parameter replacements`);
          }
        }
        
        // Execute workflow
        console.log('🎯 [Voice] Executing workflow...');
        await RendererWorkflowService.executeWorkflow(workflowToExecute, workflowToExecute.options);
        
        console.log('✅ [Voice] Workflow executed successfully');
        
        // Close popup after execution
        setTimeout(() => {
          window.close();
        }, 1500);
        
      } else {
        console.error('❌ [Voice] Workflow not found in local storage');
        lastVoiceResult.value = {
          success: false,
          message: 'Workflow not found locally',
          transcribed_text: result.transcribed_text || ''
        };
      }
    } else {
      console.log('ℹ️ [Voice] Command not matched or failed:', result.message);
    }
    
  } catch (error) {
    console.error('❌ [Voice] Error processing voice command:', error);
    
    let errorMessage = 'Failed to process voice command';
    
    if (error.name === 'AbortError') {
      errorMessage = 'Voice processing timed out';
    } else if (error.message.includes('fetch')) {
      errorMessage = 'Cannot connect to voice server. Make sure the server is running.';
    }
    
    lastVoiceResult.value = {
      success: false,
      message: errorMessage,
      transcribed_text: ''
    };
  }
};




// Convert WebM to WAV (simplified version)
const convertToWav = async (audioBlob) => {
  try {
    console.log('🔄 [Voice] Converting to WAV...');
    // For now, just return the original blob - the server can handle WebM
    return audioBlob;
  } catch (error) {
    console.error('🔄 [Voice] Conversion failed:', error);
    return audioBlob;
  }
};



// Cleanup on unmount
onUnmounted(() => {
  cleanupVoiceRecording();
});

// Rest of your existing functions...
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
    
    // Prompt for workflow name BEFORE starting recording
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
        
        // Set recording state with the workflow name
        await browser.storage.local.set({ 
          isRecording: true,
          recording: { 
            flows: [], 
            name: workflowName,
            description: ''
          }
        });
        
        // Inject recording script
        await sendMessage('inject:recordWorkflow', { tabId: tab.id }, 'background');
        
        isRecording.value = true;
        
        // Open dashboard to show recording page
        await sendMessage('open:dashboard', '/recording', 'background');
        
        window.close();
      },
    });
  } catch (error) {
    console.error('Failed to start recording:', error);
    dialog.confirm({
      title: 'Recording Failed',
      body: 'Failed to start recording. Please try again.',
      onlyOk: true,
      okVariant: 'danger',
    });
  }
};

const stopRecording = async () => {
  try {
    // Just open the recording page which handles the stop
    await sendMessage('open:dashboard', '/recording', 'background');
    window.close();
  } catch (error) {
    console.error('Failed to open recording page:', error);
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

onMounted(async () => {
  // Check recording state
  const { isRecording: recording } = await browser.storage.local.get('isRecording');
  isRecording.value = recording || false;
  
  // If recording is active, redirect to the recording page
  if (isRecording.value) {
    await sendMessage('open:dashboard', '/recording', 'background');
    window.close();
    return;
  }
  
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  state.haveAccess = /^(https?)/.test(tab.url);

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

/* Voice button styles */
.voice-btn:hover {
  background-color: rgba(59, 130, 246, 0.1) !important;
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Voice recording pulse - MORE VISIBLE */
.recording-pulse {
  animation: voiceRecordingPulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@keyframes voiceRecordingPulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
    background-color: rgba(239, 68, 68, 0.2);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.1);
    background-color: rgba(239, 68, 68, 0.4);
  }
}

/* Voice indicator animation - MORE VISIBLE */
.voice-indicator {
  width: 12px;
  height: 12px;
  background-color: #ef4444;
  border-radius: 50%;
  animation: voicePulse 0.8s ease-in-out infinite;
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
}

@keyframes voicePulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
    box-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.3);
    box-shadow: 0 0 16px rgba(239, 68, 68, 0.8);
  }
}
</style>