// src/background/CommandListener.js
import { MessageListener } from '@/utils/message';
import WorkflowManager from '@/workflowEngine/WorkflowManager';
import { useWorkflowStore } from '@/stores/workflow';

class CommandListener {
  constructor() {
    this.eventSource = null;
    this.userId = null;
    this.reconnectTimeout = null;
  }

  async connect() {
    try {
      // Get user ID
      const { user } = await browser.storage.local.get('user');
      this.userId = user?.id || 'default_user';
      
      // Close existing connection
      if (this.eventSource) {
        this.eventSource.close();
      }
      
      // Create SSE connection
      this.eventSource = new EventSource(`http://localhost:8000/sse/commands/${this.userId}`);
      
      this.eventSource.onopen = () => {
        console.log('Connected to command server');
      };
      
      this.eventSource.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received command:', data);
          
          if (data.type === 'execute_command') {
            await this.executeWorkflow(data.workflow_id, data.parameter_value, data.execution_id);
          }
        } catch (error) {
          console.error('Error handling command:', error);
        }
      };
      
      this.eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        this.reconnect();
      };
      
    } catch (error) {
      console.error('Failed to connect to command server:', error);
      this.reconnect();
    }
  }
  
  reconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    this.reconnectTimeout = setTimeout(() => {
      console.log('Attempting to reconnect...');
      this.connect();
    }, 5000);
  }
  
  async executeWorkflow(workflowId, parameterValue, executionId) {
    try {
      console.log(`Executing workflow ${workflowId} with parameter: ${parameterValue}`);
      
      // Get workflow from store
      const workflowStore = useWorkflowStore();
      await workflowStore.loadData();
      
      const workflow = workflowStore.getById(workflowId);
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }
      
      // If there's a parameter, replace it in the workflow
      if (parameterValue) {
        // Deep clone the workflow
        const workflowCopy = JSON.parse(JSON.stringify(workflow));
        
        // Replace {{parameter}} with actual value in all form blocks
        workflowCopy.drawflow.nodes.forEach(node => {
          if (node.data && node.data.value && node.data.value.includes('{{parameter}}')) {
            node.data.value = node.data.value.replace(/\{\{parameter\}\}/g, parameterValue);
          }
        });
        
        // Execute the modified workflow
        await WorkflowManager.instance.execute(workflowCopy, {});
      } else {
        // Execute workflow as is
        await WorkflowManager.instance.execute(workflow, {});
      }
      
      // Report success back to server
      await this.reportResult(executionId, 'success');
      
    } catch (error) {
      console.error('Failed to execute workflow:', error);
      await this.reportResult(executionId, 'error', error.message);
    }
  }
  
  async reportResult(executionId, status, error = null) {
    try {
      await fetch('http://localhost:8000/command-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          execution_id: executionId,
          status,
          error
        })
      });
    } catch (err) {
      console.error('Failed to report result:', err);
    }
  }
  
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
}

export default new CommandListener();