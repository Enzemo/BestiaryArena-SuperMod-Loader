(function () {
  console.log('Hello World Mod initializing...');

  const defaultConfig = {
    enabled: false,
    greeting: 'Hello from Hello World Mod!'
  };

  const config = Object.assign({}, defaultConfig, context && context.config ? context.config : {});
  const api = context && context.api ? context.api : (window && window.BestiaryModAPI ? window.BestiaryModAPI : null);

  const MOD_ID = 'hello-world-mod';
  const BUTTON_ID = `${MOD_ID}-button`;
  const SETTINGS_BUTTON_ID = `${MOD_ID}-settings`;
  const CONFIG_PANEL_ID = `${MOD_ID}-config-panel`;

  function showGreeting() {
    if (!api) return;
    api.ui.components.createModal({
      title: 'Hello World',
      content: `<p>${config.greeting}</p>`,
      buttons: [{ text: 'OK', primary: true }]
    });
  }

  function buildConfigPanel() {
    if (!api) return null;
    const content = document.createElement('div');
    content.style.display = 'grid';
    content.style.gap = '8px';

    const label = document.createElement('label');
    label.textContent = 'Greeting text:';
    label.style.color = 'white';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = config.greeting;
    input.style.width = '100%';

    content.appendChild(label);
    content.appendChild(input);

    return api.ui.createConfigPanel({
      id: CONFIG_PANEL_ID,
      title: 'Hello World Settings',
      modId: MOD_ID,
      content: content,
      buttons: [
        {
          text: 'Save',
          primary: true,
          onClick: () => {
            config.greeting = input.value;
            if (api && api.service && context && context.hash) {
              api.service.updateScriptConfig(context.hash, config);
            }
          }
        },
        { text: 'Close', primary: false }
      ]
    });
  }

  function init() {
    if (!api) {
      console.error('BestiaryModAPI not available');
      return;
    }

    api.ui.addButton({
      id: BUTTON_ID,
      text: 'Hello',
      modId: MOD_ID,
      primary: false,
      tooltip: 'Show greeting',
      onClick: showGreeting
    });

    api.ui.addButton({
      id: SETTINGS_BUTTON_ID,
      icon: '⚙️',
      tooltip: 'Hello World Settings',
      modId: MOD_ID,
      onClick: () => api.ui.toggleConfigPanel(CONFIG_PANEL_ID)
    });

    buildConfigPanel();
  }

  init();

  if (typeof exports !== 'undefined') {
    exports = {
      showGreeting,
      updateConfig: (newConfig) => {
        Object.assign(config, newConfig || {});
      }
    };
  }
})();