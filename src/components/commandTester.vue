<template>
  <div class="container py-8 px-4">
    <div class="max-w-2xl mx-auto">
      <h1 class="text-2xl font-bold mb-6">Command Tester</h1>
      
      <!-- Command Input -->
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow mb-6">
        <h2 class="text-lg font-semibold mb-4">Execute Command</h2>
        <div class="flex space-x-2">
          <ui-input
            v-model="userInput"
            placeholder="Enter command (e.g., 'Search Batman on YouTube')"
            class="flex-1"
            @keyup.enter="executeCommand"
          />
          <ui-button 
            @click="executeCommand" 
            variant="accent"
            :loading="executing"
          >
            Execute
          </ui-button>
        </div>
        
        <div v-if="result" class="mt-4 p-4 rounded-lg"
             :class="result.success ? 'bg-green-50 dark:bg-green-900' : 'bg-red-50 dark:bg-red-900'">
          <p class="font-medium" :class="result.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'">
            {{ result.success ? 'Command executed!' : 'Command failed' }}
          </p>
          <p class="text-sm mt-1" :class="result.success ? 'text-green-600 dark:text-green-300' : 'text-red-600 dark:text-red-300'">
            {{ result.message || result.command }}
          </p>
          <p v-if="result.parameter" class="text-xs mt-2">
            Parameter extracted: <code class="bg-gray-200 dark:bg-gray-700 px-1 rounded">{{ result.parameter }}</code>
          </p>
        </div>
      </div>
      
      <!-- Saved Commands List -->
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
        <h2 class="text-lg font-semibold mb-4">Saved Commands</h2>
        
        <div v-if="loading" class="text-center py-4">
          <ui-spinner />
        </div>
        
        <div v-else-if="commands.length === 0" class="text-center py-8 text-gray-500">
          No commands saved yet. Record a workflow to create commands.
        </div>
        
        <div v-else class="space-y-2">
          <div v-for="command in commands" :key="command.id"
               class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div class="flex-1">
              <p class="font-medium">{{ command.command_name }}</p>
              <p v-if="command.parameter_name" class="text-sm text-gray-600 dark:text-gray-400">
                Parameter: {{ command.parameter_name }}
              </p>
            </div>
            <div class="flex items-center space-x-2">
              <ui-button
                size="sm"
                @click="testCommand(command)"
              >
                Test
              </ui-button>
              <ui-button
                size="sm"
                variant="danger"
                icon
                @click="deleteCommand(command.id)"
              >
                <v-remixicon name="riDeleteBin7Line" />
              </ui-button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useDialog } from '@/composable/dialog';
import browser from 'webextension-polyfill';

const dialog = useDialog();

const userInput = ref('');
const result = ref(null);
const executing = ref(false);
const loading = ref(true);
const commands = ref([]);

// Show notification helper
function showNotification(message, type = 'info') {
  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500'
  };
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `fixed top-4 right-4 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-opacity duration-300`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

async function executeCommand() {
  if (!userInput.value.trim() || executing.value) return;
  
  executing.value = true;
  result.value = null;
  
  try {
    const { user } = await browser.storage.local.get('user');
    const userId = user?.id || 'default_user';
    
    const response = await fetch('http://localhost:8000/execute-command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_input: userInput.value,
        user_id: userId
      })
    });
    
    result.value = await response.json();
    
    if (result.value.success) {
      showNotification('Command executed successfully!', 'success');
    }
  } catch (error) {
    result.value = {
      success: false,
      message: error.message || 'Failed to execute command. Make sure the API server is running.'
    };
    showNotification('Failed to execute command', 'error');
  } finally {
    executing.value = false;
  }
}

async function loadCommands() {
  loading.value = true;
  
  try {
    const { user } = await browser.storage.local.get('user');
    const userId = user?.id || 'default_user';
    
    const response = await fetch(`http://localhost:8000/commands/${userId}`);
    if (response.ok) {
      commands.value = await response.json();
    } else {
      throw new Error('Failed to load commands');
    }
  } catch (error) {
    console.error('Failed to load commands:', error);
    showNotification('Failed to load commands. Make sure the API server is running.', 'error');
  } finally {
    loading.value = false;
  }
}

function testCommand(command) {
  if (command.has_parameter) {
    // For parameter commands, show example
    userInput.value = command.command_name.replace('{parameter}', 'test value');
  } else {
    userInput.value = command.command_name;
  }
}

async function deleteCommand(commandId) {
  dialog.confirm({
    title: 'Delete Command',
    body: 'Are you sure you want to delete this command?',
    okVariant: 'danger',
    onConfirm: async () => {
      try {
        const response = await fetch(`http://localhost:8000/commands/${commandId}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          showNotification('Command deleted successfully', 'success');
          await loadCommands();
        } else {
          throw new Error('Failed to delete');
        }
      } catch (error) {
        showNotification('Failed to delete command', 'error');
      }
    }
  });
}

onMounted(() => {
  loadCommands();
});
</script>