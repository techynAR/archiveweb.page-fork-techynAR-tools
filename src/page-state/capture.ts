export const captureScript = `(() => {
  const getSelector = (el) => {
    if (el.id) return '#' + el.id;
    let path = [];
    while (el && el.nodeType === Node.ELEMENT_NODE) {
      let selector = el.nodeName.toLowerCase();
      if (el.id) {
        selector += '#' + el.id;
        path.unshift(selector);
        break;
      } else {
        let sib = el, nth = 1;
        while (sib = sib.previousElementSibling) {
          if (sib.nodeName.toLowerCase() == selector) nth++;
        }
        if (nth != 1) selector += ":nth-of-type("+nth+")";
      }
      path.unshift(selector);
      el = el.parentNode;
    }
    return path.join(' > ');
  };

  const state = {
    forms: [],
    contentEditable: [],
    svgs: [],
    canvases: [],
    storage: { localStorage: {}, sessionStorage: {} }
  };

  try {
    // 1. Forms
    document.querySelectorAll('input, textarea, select').forEach(el => {
      const type = el.type ? el.type.toLowerCase() : el.nodeName.toLowerCase();
      const selector = getSelector(el);
      const formState = { selector, type, id: el.id, name: el.name };
      
      if (type === 'checkbox' || type === 'radio') {
        formState.checked = el.checked;
      } else if (type === 'select-multiple') {
        formState.selectedValues = Array.from(el.selectedOptions).map(opt => opt.value);
      } else if (type === 'select-one') {
        formState.selectedIndex = el.selectedIndex;
        formState.value = el.value;
      } else {
        formState.value = el.value;
      }
      state.forms.push(formState);
    });

    // 2. ContentEditable
    document.querySelectorAll('[contenteditable="true"]').forEach(el => {
      state.contentEditable.push({
        selector: getSelector(el),
        html: el.innerHTML,
        text: el.innerText
      });
    });

    // 3. SVG
    document.querySelectorAll('svg').forEach(el => {
      state.svgs.push({
        selector: getSelector(el),
        outerHTML: el.outerHTML
      });
    });

    // 4. Canvases
    document.querySelectorAll('canvas').forEach(el => {
      try {
        const dataURL = el.toDataURL('image/png');
        state.canvases.push({
          selector: getSelector(el),
          width: el.width,
          height: el.height,
          dataURL
        });
      } catch (e) {
        // Tainted canvas
      }
    });

    // 5. Storage (only what is not already captured by recorder.ts, but let's capture it all here for the unified state)
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      state.storage.localStorage[key] = localStorage.getItem(key);
    }
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      state.storage.sessionStorage[key] = sessionStorage.getItem(key);
    }

  } catch (e) {
    state.error = e.message;
  }

  return JSON.stringify(state);
})();`;
