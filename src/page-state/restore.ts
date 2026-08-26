export const restoreScript = `(() => {
  if (window.__awp_qc_restored) return;
  
  const restoreState = (stateStr) => {
    try {
      const state = JSON.parse(stateStr);
      
      // 1. Storage
      if (state.storage) {
        if (state.storage.localStorage) {
          for (const [k, v] of Object.entries(state.storage.localStorage)) {
            localStorage.setItem(k, v);
          }
        }
        if (state.storage.sessionStorage) {
          for (const [k, v] of Object.entries(state.storage.sessionStorage)) {
            sessionStorage.setItem(k, v);
          }
        }
      }

      // 2. Forms
      if (state.forms) {
        state.forms.forEach(formState => {
          const el = document.querySelector(formState.selector);
          if (!el) return;
          
          if (formState.type === 'checkbox' || formState.type === 'radio') {
            el.checked = formState.checked;
          } else if (formState.type === 'select-multiple' && formState.selectedValues) {
            Array.from(el.options).forEach(opt => {
              opt.selected = formState.selectedValues.includes(opt.value);
            });
          } else if (formState.type === 'select-one' && formState.selectedIndex !== undefined) {
            el.selectedIndex = formState.selectedIndex;
            el.value = formState.value;
          } else if (formState.value !== undefined) {
            el.value = formState.value;
          }
          
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        });
      }

      // 3. Content Editable
      if (state.contentEditable) {
        state.contentEditable.forEach(ce => {
          const el = document.querySelector(ce.selector);
          if (el) el.innerHTML = ce.html;
        });
      }

      // 4. SVG Overlays
      if (state.svgs) {
        state.svgs.forEach(svgState => {
          const originalEl = document.querySelector(svgState.selector);
          if (originalEl) {
            // Non-destructive SVG overlay
            const rect = originalEl.getBoundingClientRect();
            const wrapper = document.createElement('div');
            wrapper.style.position = 'absolute';
            // Assuming the parent offset or using page coordinates
            wrapper.style.left = (rect.left + window.scrollX) + 'px';
            wrapper.style.top = (rect.top + window.scrollY) + 'px';
            wrapper.style.width = rect.width + 'px';
            wrapper.style.height = rect.height + 'px';
            wrapper.style.pointerEvents = 'none'; // pass through clicks
            wrapper.style.zIndex = '999999';
            
            // Add original class/id info if needed, but safe to just overlay the visual
            wrapper.innerHTML = svgState.outerHTML;
            // The inner SVG might have absolute/relative styles, force it to fit wrapper
            const newSvg = wrapper.querySelector('svg');
            if (newSvg) {
              newSvg.style.width = '100%';
              newSvg.style.height = '100%';
              newSvg.style.position = 'absolute';
              newSvg.style.top = '0';
              newSvg.style.left = '0';
            }
            
            document.body.appendChild(wrapper);
          }
        });
      }

      // 5. Canvas Bitmaps
      if (state.canvases) {
        const restoreCanvases = () => {
          state.canvases.forEach(canvasState => {
            const el = document.querySelector(canvasState.selector);
            if (el && canvasState.dataURL) {
              const img = new Image();
              img.onload = () => {
                const ctx = el.getContext('2d');
                if (ctx) {
                  // Wait for the app to settle any redraws
                  ctx.clearRect(0, 0, el.width, el.height);
                  ctx.drawImage(img, 0, 0);
                  
                  // Setup redraw protection (bounded observer)
                  setupRedrawProtection(el, img);
                }
              };
              img.src = canvasState.dataURL;
            }
          });
        };
        
        restoreCanvases();
      }
      
      window.__awp_qc_restored = true;
      window.dispatchEvent(new CustomEvent('awp-qc-restored'));

    } catch (e) {
      console.error("AWP QC Restore Error:", e);
    }
  };

  const setupRedrawProtection = (canvas, img) => {
    let redrawCount = 0;
    const maxRedraws = 3;
    const observer = new MutationObserver(() => {
      if (redrawCount >= maxRedraws) {
        observer.disconnect();
        return;
      }
      
      // If the canvas is modified (e.g. style changes or re-injected by framework)
      // or if it was cleared. Actually, detecting canvas clear is hard without proxying getContext.
      // We will re-draw a few times on requestAnimationFrame if it looks clear.
    });
    observer.observe(canvas, { attributes: true, childList: true });
    
    // Check if it got wiped shortly after (dumb polling for 2 seconds)
    let checks = 0;
    const interval = setInterval(() => {
      checks++;
      if (checks > 10) {
        clearInterval(interval);
        return;
      }
      
      try {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const idata = ctx.getImageData(0,0,10,10).data;
          let isEmpty = true;
          for (let i = 0; i < idata.length; i++) {
            if (idata[i] !== 0) { isEmpty = false; break; }
          }
          if (isEmpty && redrawCount < maxRedraws) {
            ctx.drawImage(img, 0, 0);
            redrawCount++;
          }
        }
      } catch(e) {}
    }, 200);
  };

  // Lifecycle wait
  const init = () => {
    if (document.readyState === 'complete') {
      setTimeout(() => {
        // Fetch the state from the WARC resource
        fetch(window.location.href)
          .then(res => {
            // Not directly fetching the HTML, we need the urn:page-state resource
            // Usually, wabac provides wbinfo with originalURL.
            const url = window.__wbinfo ? window.__wbinfo.url : window.location.href;
            return fetch('/' + (window.__wbinfo ? window.__wbinfo.prefix + 'id_/' : '') + 'urn:page-state:' + url);
          })
          .then(res => res.json())
          .then(data => {
            if (data && data.snapshots && data.snapshots.length > 0) {
              const snap = data.snapshots[0];
              if (snap.domState) {
                // Combine storage back to match our script
                const stateObj = Object.assign({}, snap.domState, { storage: snap.storage });
                restoreState(JSON.stringify(stateObj));
              }
            }
          })
          .catch(err => {
             // Maybe state is in extras/page-state.json, or just silently fail if no state
             console.log("No QC snapshot found or error:", err);
          });
      }, 500); // Small settle delay
    } else {
      window.addEventListener('load', init);
    }
  };
  
  init();
})();`;
