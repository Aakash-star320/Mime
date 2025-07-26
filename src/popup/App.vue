<template>
  <template v-if="retrieved">
    <router-view />
    <ui-dialog />
  </template>
</template>
<script setup>
import { ref, onMounted } from 'vue';
import browser from 'webextension-polyfill';
import { useStore } from '@/stores/main';
import { sendMessage } from '@/utils/message';
import { useWorkflowStore } from '@/stores/workflow';
import { useHostedWorkflowStore } from '@/stores/hostedWorkflow';
import { loadLocaleMessages, setI18nLanguage } from '@/lib/vueI18n';

const store = useStore();
const workflowStore = useWorkflowStore();
const hostedWorkflowStore = useHostedWorkflowStore();

const retrieved = ref(false);

browser.storage.local.get('isRecording').then(({ isRecording }) => {
  if (!isRecording) return;

  sendMessage('open:dashboard', '/recording', 'background').then(() => {
    window.close();
  });
});

onMounted(async () => {
  try {
    await store.loadSettings();
    await loadLocaleMessages(store.settings.locale, 'popup');
    await setI18nLanguage(store.settings.locale);

    await workflowStore.loadData();
    await hostedWorkflowStore.loadData();

    retrieved.value = true;

    
  } catch (error) {
    console.error(error);
    retrieved.value = true;
  }

  // Execute command endpoint - FIXED PARAMETER MATCHING
app.post('/execute-command', async (req, res) => {
  const { user_input, user_id } = req.body;
  
  console.log(`\n=== Executing command for user ${user_id}: "${user_input}"`);
  
  try {
    // Get all commands for the user
    const query = 'SELECT * FROM commands WHERE user_id = $1 ORDER BY has_parameter ASC, command_name ASC';
    const result = await pool.query(query, [user_id]);
    
    console.log(`Found ${result.rows.length} commands`);
    
    // First, check commands without parameters (exact match)
    for (const command of result.rows) {
      if (!command.has_parameter) {
        if (user_input.toLowerCase() === command.command_name.toLowerCase()) {
          console.log(`Matched exact command: ${command.command_name}`);
          
          // Check if user has SSE connection
          const sseClient = sseClients.get(user_id);
          if (!sseClient) {
            console.log('No SSE client found for user:', user_id);
            console.log('Available SSE clients:', Array.from(sseClients.keys()));
            return res.json({
              success: false,
              message: 'Extension not connected. Please make sure Automa is running and refresh the dashboard.'
            });
          }
          
          // Send command to extension via SSE
          const executionId = `exec_${Date.now()}`;
          const commandMessage = {
            type: 'execute_command',
            workflow_id: command.workflow_id,
            parameter_value: null,
            execution_id: executionId
          };
          
          console.log('Sending command to extension:', commandMessage);
          sseClient.write(`data: ${JSON.stringify(commandMessage)}\n\n`);
          
          return res.json({
            success: true,
            command: command.command_name,
            parameter: null,
            execution_id: executionId,
            message: 'Command sent to Automa for execution'
          });
        }
      }
    }
    
    // Then check commands with parameters
    for (const command of result.rows) {
      if (command.has_parameter && command.parameter_name) {
        // The template has "{{parameter}}" in it
        let template = command.command_name;
        console.log(`\nChecking template: "${template}"`);
        
        // Find where {{parameter}} is in the template
        const paramMarker = '{{parameter}}';
        const paramIndex = template.indexOf(paramMarker);
        
        if (paramIndex === -1) {
          console.error('No {{parameter}} found in template');
          continue;
        }
        
        // Get the parts before and after {{parameter}}
        const beforeParam = template.substring(0, paramIndex);
        const afterParam = template.substring(paramIndex + paramMarker.length);
        
        console.log(`Before parameter: "${beforeParam}"`);
        console.log(`After parameter: "${afterParam}"`);
        
        // Check if user input matches this pattern
        const inputLower = user_input.toLowerCase();
        const beforeLower = beforeParam.toLowerCase();
        const afterLower = afterParam.toLowerCase();
        
        // Check if input starts with the "before" part and ends with the "after" part
        if (inputLower.startsWith(beforeLower)) {
          // Find where the "after" part starts in the input
          const afterIndex = inputLower.lastIndexOf(afterLower);
          
          if (afterIndex !== -1 && afterIndex >= beforeParam.length) {
            // Extract the parameter value
            const paramValue = user_input.substring(beforeParam.length, afterIndex).trim();
            
            // Verify the ending matches exactly
            const expectedEnding = user_input.substring(afterIndex);
            if (expectedEnding.toLowerCase() === afterLower) {
              console.log(`✓ MATCHED! Extracted parameter: "${paramValue}"`);
              
              // Check SSE connection
              const sseClient = sseClients.get(user_id);
              if (!sseClient) {
                return res.json({
                  success: false,
                  message: 'Extension not connected. Please make sure Automa is running and refresh the dashboard.'
                });
              }
              
              // Send command to extension
              const executionId = `exec_${Date.now()}`;
              const commandMessage = {
                type: 'execute_command',
                workflow_id: command.workflow_id,
                parameter_value: paramValue,
                execution_id: executionId
              };
              
              console.log('Sending command to extension:', commandMessage);
              sseClient.write(`data: ${JSON.stringify(commandMessage)}\n\n`);
              
              return res.json({
                success: true,
                command: command.command_name,
                parameter: paramValue,
                execution_id: executionId,
                message: 'Command sent to Automa for execution'
              });
            }
          }
        }
      }
    }
    
    // No matching command found
    console.log('No matching command found');
    res.json({
      success: false,
      message: 'No matching command found'
    });
    
  } catch (error) {
    console.error('Error executing command:', error);
    res.status(500).json({
      success: false,
      error: 'Command execution failed',
      details: error.message
    });
  }
});
});
</script>
<style>
body {
  height: 500px;
  width: 350px;
  font-size: 16px;
}
</style>