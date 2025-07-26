import browser from 'webextension-polyfill';
import initElementSelector from './main';
import initRecordEvents from './recordEvents';
import selectorFrameContext from '../../elementSelector/selectorFrameContext';

// At the top of src/content/services/recordWorkflow/index.js

(async () => {
  try {
    // Check if we're already initialized to avoid double injection
    if (window.automaRecordingInitialized) {
      console.log('Recording already initialized');
      return;
    }
    
    window.automaRecordingInitialized = true;
    
    let elementSelectorInstance = null;
    const isMainFrame = window.self === window.top;
    const destroyRecordEvents = await initRecordEvents(isMainFrame);

    if (isMainFrame) {
      const element = document.querySelector('#automa-recording');
      if (element) {
        console.log('Recording UI already exists');
        return;
      }

      elementSelectorInstance = await initElementSelector();
    } else {
      const style = document.createElement('style');
      style.textContent = '[automa-el-list] {outline: 2px dashed #6366f1;}';
      document.body.appendChild(style);
      selectorFrameContext();
    }

    browser.runtime.onMessage.addListener(function messageListener({ type }) {
      if (type === 'recording:stop') {
        if (elementSelectorInstance) {
          elementSelectorInstance.unmount();
        }
        destroyRecordEvents();
        browser.runtime.onMessage.removeListener(messageListener);
        window.automaRecordingInitialized = false;
      }
    });
    
    console.log('Recording script initialized successfully');
  } catch (error) {
    console.error('Recording initialization error:', error);
    window.automaRecordingInitialized = false;
  }
})();
