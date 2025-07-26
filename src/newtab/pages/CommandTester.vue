<template>
  <div class="container py-8 px-4">
    <h1 class="text-2xl font-bold mb-6">Command Tester</h1>
    
    <!-- Execute Command Section -->
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
          :disabled="executing"
        >
          {{ executing ? 'Executing...' : 'Execute' }}
        </ui-button>
      </div>
      
      <div v-if="result" class="mt-4 p-4 rounded-lg"
           :class="result.success ? 'bg-green-50 dark:bg-green-900' : 'bg-red-50 dark:bg-red-900'">
        <p class="font-medium">
          {{ result.success ? '✓ Command executed!' : '✗ Command failed' }}
        </p>
        <p class="text-sm mt-1">
          {{ result.message || result.command }}
        </p>
        <p v-if="result.parameter" class="text-xs mt-2">
          Parameter: <code class="bg-gray-200 dark:bg-gray-700 px-1 rounded">{{ result.parameter }}</code>
        </p>
        <p v-if="result.workflow_id" class="text-xs mt-1">
          Workflow ID: <code class="bg-gray-200 dark:bg-gray-700 px-1 rounded">{{ result.workflow_id }}</code>
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
        No commands saved yet. Record a workflow with parameters to create commands.
      </div>
      
      <ui-list v-else class="space-y-1">
        <ui-list-item
          v-for="command in commands"
          :key="command.id"
          class="group"
        >
          <div class="flex-1">
            <p class="font-medium">{{ command.command_name }}</p>
            <p v-if="command.parameter_name" class="text-sm text-gray-600 dark:text-gray-400">
              Parameter: {{ command.parameter_name }}
            </p>
          </div>
          <div class="flex items-center space-x-2 invisible group-hover:visible">
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
              @click="confirmDelete(command)"
            >
              <v-remixicon name="riDeleteBin7Line" />
            </ui-button>
          </div>
        </ui-list-item>
      </ui-list>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useDialog } from '@/composable/dialog';
import { useWorkflowStore } from '@/stores/workflow';
import RendererWorkflowService from '@/service/renderer/RendererWorkflowService';
import browser from 'webextension-polyfill';

const dialog = useDialog();
const workflowStore = useWorkflowStore();

const userInput = ref('');
const result = ref(null);
const executing = ref(false);
const loading = ref(true);
const commands = ref([]);

// Updated executeCommand function for CommandTester.vue

async function executeCommand() {
  if (!userInput.value.trim() || executing.value) return;
  
  executing.value = true;
  result.value = null;
  
  try {
    const { user } = await browser.storage.local.get('user');
    const userId = user?.id || 'default_user';
    
    console.log('Executing command:', userInput.value);
    
    // First, get the command match from the server
    const response = await fetch('http://localhost:8000/execute-command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_input: userInput.value,
        user_id: userId
      })
    });
    
    const data = await response.json();
    console.log('Server response:', data);
    
    if (data.success && data.workflow_id) {
      // Get the workflow from the store
      console.log('Looking for workflow:', data.workflow_id);
      
      // Make sure workflow store is loaded
      if (!workflowStore.retrieved) {
        console.log('Loading workflow store...');
        await workflowStore.loadData();
      }
      
      const workflow = workflowStore.getById(data.workflow_id);
      console.log('Found workflow:', workflow);
      
      if (workflow) {
        try {
          let workflowToExecute = workflow;
          
          // If there's a parameter, we need to replace {{parameter}} in the workflow
          if (data.parameter) {
            console.log('Replacing parameter:', data.parameter);
            // Deep clone the workflow to avoid modifying the original
            workflowToExecute = JSON.parse(JSON.stringify(workflow));
            
            // Replace {{parameter}} with the actual value in all nodes
            if (workflowToExecute.drawflow && workflowToExecute.drawflow.nodes) {
              workflowToExecute.drawflow.nodes.forEach(node => {
                // Check in forms blocks and other data fields
                if (node.data) {
                  // Check value field (most common for forms)
                  if (node.data.value && typeof node.data.value === 'string') {
                    if (node.data.value.includes('{{parameter}}')) {
                      console.log('Replacing in node:', node.id, 'old value:', node.data.value);
                      node.data.value = node.data.value.replace(/\{\{parameter\}\}/g, data.parameter);
                      console.log('New value:', node.data.value);
                    }
                  }
                  
                  // Check other possible fields that might contain parameters
                  ['code', 'url', 'text', 'selector'].forEach(field => {
                    if (node.data[field] && typeof node.data[field] === 'string') {
                      if (node.data[field].includes('{{parameter}}')) {
                        console.log(`Replacing in node ${node.id} field ${field}:`, node.data[field]);
                        node.data[field] = node.data[field].replace(/\{\{parameter\}\}/g, data.parameter);
                      }
                    }
                  });
                }
              });
            }
          }
          
          // Execute the workflow using Automa's service
          console.log('Executing workflow...');
          await RendererWorkflowService.executeWorkflow(workflowToExecute);
          console.log('Workflow execution completed');
          
          result.value = {
            success: true,
            command: data.command,
            parameter: data.parameter,
            workflow_id: data.workflow_id,
            message: `Successfully executed workflow${data.parameter ? ` with parameter "${data.parameter}"` : ''}`
          };
        } catch (execError) {
          console.error('Workflow execution error:', execError);
          result.value = {
            success: false,
            message: `Failed to execute workflow: ${execError.message}`
          };
        }
      } else {
        console.error('Workflow not found:', data.workflow_id);
        // List all available workflows for debugging
        const availableWorkflows = workflowStore.getWorkflows.map(w => ({ id: w.id, name: w.name }));
        console.log('Available workflows:', availableWorkflows);
        
        result.value = {
          success: false,
          message: `Workflow with ID ${data.workflow_id} not found. Available workflows: ${availableWorkflows.length}. Try reloading the extension or re-recording the workflow.`
        };
      }
    } else {
      // Command not matched or other error
      result.value = data;
    }
  } catch (error) {
    console.error('Command execution error:', error);
    result.value = {
      success: false,
      message: 'Failed to connect to API server. Make sure it\'s running on port 8000.'
    };
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
    }
  } catch (error) {
    console.error('Failed to load commands:', error);
  } finally {
    loading.value = false;
  }
}

function testCommand(command) {
  if (command.has_parameter && command.parameter_name) {
    // For testing, replace the parameter with a sample value
    // Since the command is stored like "Search Flash on Youtube", 
    // we need to replace the actual parameter value
    const savedParam = command.parameter_name;
    const testParam = 'test';
    userInput.value = command.command_name.replace(savedParam, testParam);
  } else {
    userInput.value = command.command_name;
  }
  // Automatically execute after setting the test command
  executeCommand();
}

function confirmDelete(command) {
  dialog.confirm({
    title: 'Delete Command',
    body: `Are you sure you want to delete "${command.command_name}"?`,
    okText: 'Delete',
    okVariant: 'danger',
    onConfirm: () => deleteCommand(command.id)
  });
}

async function deleteCommand(commandId) {
  try {
    const response = await fetch(`http://localhost:8000/commands/${commandId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      await loadCommands();
    }
  } catch (error) {
    console.error('Failed to delete command:', error);
  }
}

onMounted(() => {
  loadCommands();
});
</script>