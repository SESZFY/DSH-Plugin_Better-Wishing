// AI4S composer seat, adapted from DeepSeek's MIT-licensed model selector.
// See LICENSE.deepseek. DSH still owns the shared model directory and /model command.
window.__ModuleLoader__.load({
  id: 'dsh-ai4s-composer',
  factory(require) {
    const _deepseek_ai_dsh_client_ui_primitives = require('@deepseek-ai/dsh-client-ui-primitives');
    const react_jsx_runtime = require('react/jsx-runtime');
    const react = require('react');
    const react_dom = require('react-dom');
    const clsx = (...names) => names.filter(Boolean).join(' ');
    const labelSeat = 'conversation.input.model.ai4s.label';

    const menuStyles = `
._9r0rkG_root{min-width:0;position:relative}
._9r0rkG_trigger{border-radius:var(--dsw-radius-sm);min-width:0;max-width:min(360px,45cqw);height:28px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;outline:none;align-items:center;gap:4px;padding:0 4px 0 8px;font-size:13px;font-weight:400;line-height:20px;display:flex}
._9r0rkG_trigger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
._9r0rkG_trigger:focus-visible:not([data-selection-focus]){box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary))}
._9r0rkG_trigger:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}
._9r0rkG_triggerLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}
._9r0rkG_triggerEffort{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-caption);flex-shrink:1000;overflow:hidden}
._9r0rkG_triggerIcon{display:var(--dsh-composer-model-icon-display,none);flex:none}
._9r0rkG_triggerLabel,._9r0rkG_triggerEffort{display:var(--dsh-composer-model-text-display,block)}
._9r0rkG_chevron{color:var(--dsw-alias-label-caption);flex:none;transition:transform .12s}
._9r0rkG_chevronOpen{transform:rotate(180deg)}
._9r0rkG_menu{z-index:1100;--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);width:max-content;min-width:min(240px,100vw - 32px);max-width:min(420px,100vw - 32px);max-height:min(360px,100vh - 96px);box-shadow:var(--dsw-elevation-prominent);color:var(--dsw-alias-label-primary);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);border:0;flex-direction:column;padding:4px;display:flex;position:fixed;overflow:hidden}
._9r0rkG_status,._9r0rkG_empty{color:var(--dsw-alias-label-tertiary);padding:8px;font-size:12px;line-height:18px}
._9r0rkG_error,._9r0rkG_warning{border-radius:var(--dsw-radius-md);background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary);justify-content:space-between;align-items:flex-start;gap:6px;margin-bottom:3px;padding:6px 7px;font-size:11px;line-height:16px;display:flex}
._9r0rkG_warning{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-state-warn-label)}
._9r0rkG_retry{color:inherit;font:inherit;cursor:pointer;background:0 0;border:none;flex:none;padding:0;font-weight:600}
._9r0rkG_searchRow{flex-shrink:0;margin:2px 0 3px;position:relative}
._9r0rkG_searchRow ._9r0rkG_search{border-radius:var(--dsw-radius-md);background:0 0;border:0 solid #0000;height:auto;padding:5px 7px;display:flex}
._9r0rkG_searchRow ._9r0rkG_searchWithQuery{padding-right:34px}
._9r0rkG_searchClear{corner-shape:round;width:24px;height:24px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:50%;justify-content:center;align-items:center;padding:0;display:inline-flex;position:absolute;top:50%;right:4px;transform:translateY(-50%)}
._9r0rkG_searchClear:hover,._9r0rkG_searchClear:focus-visible{background:var(--dsw-alias-interactive-bg-hover);outline:none}
._9r0rkG_searchRow ._9r0rkG_search:focus-within{border-color:#0000}
._9r0rkG_searchRow ._9r0rkG_search input{padding:0;font-size:12px;line-height:normal}
._9r0rkG_searchRow ._9r0rkG_search input::placeholder{color:var(--dsw-alias-label-caption)}
._9r0rkG_groups{min-height:0;overflow-y:auto}
._9r0rkG_option{box-sizing:border-box;border-radius:var(--dsw-radius-md);width:auto;min-width:100%;min-height:34px;color:inherit;text-align:left;cursor:pointer;background:0 0;border:none;outline:none;align-items:center;gap:6px;padding:5px 7px;display:flex}
._9r0rkG_option:not(._9r0rkG_modelOption):hover:not(:disabled),._9r0rkG_option:focus-visible,._9r0rkG_optionActive:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
._9r0rkG_selected{background:0 0}
._9r0rkG_option:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}
._9r0rkG_optionCopy{flex-direction:column;flex:1;min-width:0;display:flex}
._9r0rkG_modelName{color:inherit;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:400;line-height:18px;overflow:hidden}
._9r0rkG_check{color:var(--dsw-alias-label-primary);flex:0 0 14px;place-items:center;display:grid}
._9r0rkG_check svg{width:14px;height:14px}
._9r0rkG_cell{box-sizing:border-box;border-radius:var(--dsw-radius-md);width:auto;min-width:100%;height:34px;color:var(--dsw-alias-label-primary);cursor:pointer;text-align:left;background:0 0;border:none;outline:none;align-items:center;gap:6px;padding:0 8px;font-size:13px;line-height:20px;display:flex}
._9r0rkG_cell:hover,._9r0rkG_cell:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}
._9r0rkG_cellLabel{white-space:nowrap;flex:none}
._9r0rkG_cellValue{text-overflow:ellipsis;white-space:nowrap;text-align:right;min-width:0;color:var(--dsw-alias-label-tertiary);flex:auto;overflow:hidden}
._9r0rkG_cellChevron{width:12px;height:12px;color:var(--dsw-alias-menu-icon);flex:none}
._9r0rkG_menu{max-width:min(620px,100vw - 32px)}
._9r0rkG_twoPane{display:flex;align-items:stretch;gap:6px;min-height:0;max-height:100%}
._9r0rkG_paneRoot{display:flex;flex-direction:column;flex:none;width:min(228px,42vw);min-width:0}
._9r0rkG_paneBody{display:flex;flex-direction:column;flex:1 1 auto;min-width:0;max-width:min(320px,46vw);border-left:1px solid var(--dsw-alias-border-l1);padding-left:6px;overflow:hidden}
._9r0rkG_paneBody ._9r0rkG_groups{flex:1 1 auto}
.dsh-worker-model-picker{border-top:1px solid var(--dsw-alias-border-l1);display:grid;gap:6px;padding:8px 5px 5px;font-size:12px}
.dsh-worker-model-picker select{width:100%;min-width:0;padding:6px;color:inherit;background:var(--dsw-alias-bg-elevated,Canvas);border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md);color-scheme:light dark}
`;

    const ModelSelect_module_css_default = {
      "cell": "_9r0rkG_cell",
      "cellChevron": "_9r0rkG_cellChevron",
      "twoPane": "_9r0rkG_twoPane",
      "paneRoot": "_9r0rkG_paneRoot",
      "paneBody": "_9r0rkG_paneBody",
      "cellLabel": "_9r0rkG_cellLabel",
      "cellValue": "_9r0rkG_cellValue",
      "check": "_9r0rkG_check",
      "chevron": "_9r0rkG_chevron",
      "chevronOpen": "_9r0rkG_chevronOpen",
      "empty": "_9r0rkG_empty",
      "error": "_9r0rkG_error",
      "groups": "_9r0rkG_groups",
      "menu": "_9r0rkG_menu",
      "modelName": "_9r0rkG_modelName",
      "modelOption": "_9r0rkG_modelOption",
      "option": "_9r0rkG_option",
      "optionActive": "_9r0rkG_optionActive",
      "optionCopy": "_9r0rkG_optionCopy",
      "retry": "_9r0rkG_retry",
      "root": "_9r0rkG_root",
      "search": "_9r0rkG_search",
      "searchClear": "_9r0rkG_searchClear",
      "searchRow": "_9r0rkG_searchRow",
      "searchWithQuery": "_9r0rkG_searchWithQuery",
      "selected": "_9r0rkG_selected",
      "status": "_9r0rkG_status",
      "trigger": "_9r0rkG_trigger",
      "triggerEffort": "_9r0rkG_triggerEffort",
      "triggerIcon": "_9r0rkG_triggerIcon",
      "triggerLabel": "_9r0rkG_triggerLabel",
      "warning": "_9r0rkG_warning"
    };
    /** Shared provider display order for the composer and command model pickers. */
    /**
    * Put the account and official providers first, preserving every other relative order.
    * @param groups - Provider groups in catalog order.
    * @returns a sorted copy; model order within each group is unchanged.
    */
    function orderModelProviders(groups) {
      return groups.toSorted((left, right) => (left.id === "deepseek-account" ? 0 : left.id === "deepseek-official" ? 1 : 2) - (right.id === "deepseek-account" ? 0 : right.id === "deepseek-official" ? 1 : 2));
    }
    /**
    * ModelSelect: the composer's named model seat (`conversation.input.model`).
    * Two-level selection per figma 496:26454's MenuDropdown: the root menu is
    * the Model / Effort row pair (label + current value + a right chevron),
    * each drilling into its own list — the provider-grouped model list over
    * the shared directory, and the effort levels. The trigger (313:14108's
    * ToggleButton) shows both: model name + effort in the caption tone.
    * Model catalogs above four entries show search, which retains focus while
    * ↑/↓ cycle the highlighted result; Enter and Tab accept it. Smaller model
    * catalogs, root panes, and effort panes move focus between rows. Escape and Shift+Tab leave a drilled pane first and otherwise close
    * back to the trigger. A drilled pane focuses the current effort or model
    * search field. Provider headings paint their background only while pinned
    * by scrolling. Clearing a query restores the full list and search focus.
    * Selecting restores trigger focus without a ring until the trigger loses focus
    * or the menu reopens. Model names match a case-insensitive ordered subsequence
    * within each provider group, ranked by
    * prefix, alignment score, then catalog order. Returning to the root pane
    * hands focus back to the cell that opened it. Data and submission ride the
    * same per-session ModelDirectory as the /model popup; exact-model reasoning
    * metadata and the selected effort come from the Host rather than a
    * client-owned vocabulary. A rejected selection announces through the shared
    * transient Toast anchored to the composer card; the in-menu strip with
    * Retry remains the catalog-load surface. While the directory's pending
    * selection is unsettled, the trigger shows a spinner in place of its
    * chevron, and each row whose value that selection carries shows one in place
    * of its check mark.
    */
    /** Unplaced portal card: hidden but laid out at a fixed origin so offsetWidth/offsetHeight are real (Menu primitive's measure pass). */
    const MEASURE_STYLE = {
      visibility: "hidden",
      left: 0,
      top: 0
    };
    const DEFAULT_MODE = "solo";
    const COMPOSER_PREFS_PATH = "/api/clawsgo/composer";
    const workerMode = (mode) => mode === "delegate" || mode === "cluster";
    const workerRouteKey = (route) => route ? JSON.stringify([route.provider, route.model]) : "";
    async function requestComposerPreferences(sessionId, patch) {
      const url = `${COMPOSER_PREFS_PATH}?${new URLSearchParams({ sessionId })}`;
      const response = await fetch(url, patch === void 0 ? { cache: "no-store" } : {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.models) throw new Error(result?.error ?? `HTTP ${response.status}`);
      return result;
    }
    /** The four modes, in menu order (names and blurbs mirror the ClawsGO desktop menu). */
    const COMPOSER_MODES = [
      {
        id: "quick",
        labelKey: "mode.quick",
        descKey: "mode.quick.desc",
        icon: "bolt"
      },
      {
        id: "solo",
        labelKey: "mode.solo",
        descKey: "mode.solo.desc",
        icon: "spark"
      },
      {
        id: "delegate",
        labelKey: "mode.delegate",
        descKey: "mode.delegate.desc",
        icon: "tree"
      },
      {
        id: "cluster",
        labelKey: "mode.cluster",
        descKey: "mode.cluster.desc",
        icon: "cluster"
      }
    ];
    /** Inline icon per mode, sized to the menu's 14px check/icon slot. */
    function composerModeIcon(kind) {
      const stroke = {
        width: 14,
        height: 14,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.7,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": "true",
        style: {
          flex: "0 0 14px",
          color: "var(--dsw-alias-label-secondary)"
        }
      };
      if (kind === "bolt") return (0, react_jsx_runtime.jsx)("svg", {
        ...stroke,
        fill: "currentColor",
        stroke: "none",
        children: (0, react_jsx_runtime.jsx)("path", { d: "M13.2 2 4.6 13.3h5.2L9.4 22l8.6-11.3h-5.2L13.2 2Z" })
      });
      if (kind === "spark") return (0, react_jsx_runtime.jsx)("svg", {
        ...stroke,
        fill: "currentColor",
        stroke: "none",
        children: (0, react_jsx_runtime.jsx)("path", { d: "M12 2.2l2.6 6.4 6.4 2.6-6.4 2.6L12 20.2l-2.6-6.4L3 11.2l6.4-2.6L12 2.2Z" })
      });
      if (kind === "tree") return (0, react_jsx_runtime.jsxs)("svg", {
        ...stroke,
        children: [(0, react_jsx_runtime.jsx)("circle", {
          cx: 12,
          cy: 4.8,
          r: 2.3
        }), (0, react_jsx_runtime.jsx)("circle", {
          cx: 5.6,
          cy: 18.4,
          r: 2.3
        }), (0, react_jsx_runtime.jsx)("circle", {
          cx: 18.4,
          cy: 18.4,
          r: 2.3
        }), (0, react_jsx_runtime.jsx)("path", { d: "M12 7.1v3.2M5.6 16.1v-2.6h12.8v2.6" })]
      });
      return (0, react_jsx_runtime.jsxs)("svg", {
        ...stroke,
        children: [(0, react_jsx_runtime.jsx)("circle", {
          cx: 12,
          cy: 12,
          r: 2.1
        }), (0, react_jsx_runtime.jsx)("circle", {
          cx: 12,
          cy: 4.4,
          r: 1.5
        }), (0, react_jsx_runtime.jsx)("circle", {
          cx: 12,
          cy: 19.6,
          r: 1.5
        }), (0, react_jsx_runtime.jsx)("circle", {
          cx: 4.4,
          cy: 12,
          r: 1.5
        }), (0, react_jsx_runtime.jsx)("circle", {
          cx: 19.6,
          cy: 12,
          r: 1.5
        })]
      });
    }
    /**
    * Render the composer model seat.
    * @param props - owner share (locked) + injected face (shared directory
    * store/verbs) + the standard locale seat.
    * @returns the trigger and, while open, the two-level menu.
    */
    function ModelSelect({ sessionId, locked, available, directory, load, select, t, renderSlot }) {
      const state = (0, react.useSyncExternalStore)((fn) => directory.subscribe(fn), () => directory.getSnapshot());
      const [open, setOpen] = (0, react.useState)(false);
      const [pane, setPane] = (0, react.useState)("root");
      const [query, setQuery] = (0, react.useState)("");
      const [highlightedIndex, setHighlightedIndex] = (0, react.useState)(null);
      const [selectionFocus, setSelectionFocus] = (0, react.useState)(false);
      const [composerMode, setComposerMode] = (0, react.useState)(DEFAULT_MODE);
      const [workerModels, setWorkerModels] = (0, react.useState)({ delegate: null, cluster: null });
      const [savingPreferences, setSavingPreferences] = (0, react.useState)(false);
      const preferencesBusy = (0, react.useRef)(false);
      const preferencesRevision = (0, react.useRef)(0);
      const workerSelectRef = (0, react.useRef)(null);
      const lastActionRef = (0, react.useRef)("load");
      const [toast, setToast] = (0, react.useState)(null);
      const toastSeq = (0, react.useRef)(0);
      const rootRef = (0, react.useRef)(null);
      const triggerRef = (0, react.useRef)(null);
      const searchRef = (0, react.useRef)(null);
      const menuRef = (0, react.useRef)(null);
      const groupsRef = (0, react.useRef)(null);
      const [menuPos, setMenuPos] = (0, react.useState)(null);
      const itemRefs = (0, react.useRef)([]);
      const id = (0, react.useId)();
      const accountProviderName = t("provider.account");
      const groups = (0, react.useMemo)(() => orderModelProviders(state.groups).map((group) => ({
        ...group,
        provider: {
          id: group.id,
          name: group.id === "deepseek-account" ? accountProviderName : group.name
        }
      })), [state.groups, accountProviderName]);
      const choices = (0, react.useMemo)(() => groups.flatMap((group) => group.models.map((model) => ({
        group,
        model,
        selection: {
          provider: group.id,
          model: model.id,
          ...model.reasoning?.defaultEffort === void 0 ? {} : { reasoningEffort: model.reasoning.defaultEffort }
        }
      }))), [groups]);
      const showSearch = choices.length > 4;
      const filteredGroups = (0, react.useMemo)(() => groups.map((group) => ({
        ...group,
        models: (0, _deepseek_ai_dsh_client_ui_primitives.rankByName)(group.models, showSearch ? query.trim() : "")
      })).filter((group) => group.models.length > 0), [
        groups,
        query,
        showSearch
      ]);
      const visibleModels = (0, react.useMemo)(() => filteredGroups.flatMap((group) => group.models.map((model) => ({
        provider: group.id,
        model: model.id
      }))), [filteredGroups]);
      const currentVisibleIndex = visibleModels.findIndex((model) => model.provider === state.current?.provider && model.model === state.current.model);
      const activeModelIndex = Math.min(highlightedIndex ?? Math.max(0, currentVisibleIndex), visibleModels.length - 1);
      const currentChoice = choices[state.current === null ? -1 : choices.findIndex((c) => c.selection.provider === state.current?.provider && c.selection.model === state.current.model)];
      const reasoning = currentChoice?.model.reasoning;
      const effectiveEffort = state.current?.reasoningEffort ?? reasoning?.defaultEffort;
      const effortLabel = currentChoice === void 0 ? void 0 : reasoning === void 0 ? state.retainedEffort : effectiveEffort === void 0 ? t("effort.providerDefault") : reasoning.efforts.find((level) => level.id === effectiveEffort)?.name ?? effectiveEffort;
      const effortChoices = (0, react.useMemo)(() => reasoning === void 0 ? [] : [...reasoning.defaultEffort === void 0 ? [{
        key: "provider-default",
        effort: void 0,
        label: t("effort.providerDefault")
      }] : [], ...reasoning.efforts.map((effort) => ({
        key: `effort:${effort.id}`,
        effort: effort.id,
        label: effort.name
      }))], [reasoning, t]);
      const currentMode = COMPOSER_MODES.find((mode) => mode.id === composerMode) ?? COMPOSER_MODES[1];
      /** Root-menu rows in render order; each row's position also keys keyboard focus hand-back. */
      const rootCells = (0, react.useMemo)(() => reasoning === void 0 ? [
        "mode",
        "model"
      ] : [
        "mode",
        "model",
        "effort"
      ], [reasoning]);
      (0, react.useEffect)(() => {
        if (!available) return;
        let mounted = true;
        const revision = preferencesRevision.current;
        requestComposerPreferences(sessionId).then((preferences) => {
          if (!mounted || preferencesRevision.current !== revision) return;
          setComposerMode(preferences.mode);
          setWorkerModels(preferences.models);
        }).catch(() => {});
        return () => { mounted = false; };
      }, [available, sessionId]);
      const { pending } = state;
      const busy = pending !== null;
      const reload = () => {
        lastActionRef.current = "load";
        load();
      };
      (0, react.useEffect)(() => {
        if (!open) return;
        const closeOutside = (event) => {
          if (rootRef.current?.contains(event.target) === true) return;
          if (menuRef.current?.contains(event.target) === true) return;
          setOpen(false);
        };
        document.addEventListener("mousedown", closeOutside);
        return () => {
          document.removeEventListener("mousedown", closeOutside);
        };
      }, [open]);
      (0, react.useLayoutEffect)(() => {
        if (!showSearch) {
          setQuery("");
          setHighlightedIndex(null);
        }
      }, [showSearch]);
      const paneFocus = (0, react.useRef)(null);
      const previousShowSearch = (0, react.useRef)(showSearch);
      (0, react.useEffect)(() => {
        const changedSearchMode = previousShowSearch.current !== showSearch;
        previousShowSearch.current = showSearch;
        const intent = paneFocus.current ?? (changedSearchMode && pane === "model" ? "drill" : null);
        paneFocus.current = null;
        if (!open || intent === null) return;
        if (intent === "drill") {
          if (pane === "model" && showSearch) {
            searchRef.current?.focus();
            return;
          }
          (menuRef.current?.querySelector("[role=\"menuitemradio\"][aria-checked=\"true\"]:not([disabled])") ?? itemRefs.current.find((item) => item !== null && !item.disabled) ?? triggerRef.current)?.focus();
          return;
        }
        const cell = itemRefs.current[rootCells.indexOf(intent)];
        (cell !== null && cell !== void 0 && !cell.disabled ? cell : triggerRef.current)?.focus();
      }, [
        open,
        pane,
        showSearch
      ]);
      (0, react.useEffect)(() => {
        const viewport = groupsRef.current;
        if (viewport === null) return;
        return (0, _deepseek_ai_dsh_client_ui_primitives.observeStickyMenuGroups)(viewport);
      }, [
        available,
        open,
        pane,
        filteredGroups
      ]);
      (0, react.useLayoutEffect)(() => {
        if (open && pane === "model" && activeModelIndex >= 0) itemRefs.current[activeModelIndex]?.scrollIntoView({ block: "nearest" });
      }, [
        open,
        pane,
        activeModelIndex,
        visibleModels
      ]);
      (0, react.useLayoutEffect)(() => {
        if (!available || !open) {
          setMenuPos(null);
          return;
        }
        const place = () => {
          /* v8 ignore next 2 -- the trigger ref is attached whenever the menu is open. */
          const rect = triggerRef.current?.getBoundingClientRect();
          if (rect === void 0) return;
          const MARGIN = 12;
          const lw = menuRef.current?.offsetWidth ?? 0;
          const lh = menuRef.current?.offsetHeight ?? 0;
          let x = rect.right - lw;
          let y = rect.top - 8 - lh;
          if (lw > 0) x = Math.min(Math.max(x, MARGIN), window.innerWidth - lw - MARGIN);
          if (lh > 0) y = Math.min(Math.max(y, MARGIN), window.innerHeight - lh - MARGIN);
          setMenuPos({
            left: x,
            top: y
          });
        };
        place();
        window.addEventListener("scroll", place, true);
        window.addEventListener("resize", place);
        const menu = menuRef.current;
        const observer = typeof ResizeObserver !== "undefined" && menu !== null ? new ResizeObserver(place) : null;
        if (menu !== null) observer?.observe(menu);
        return () => {
          observer?.disconnect();
          window.removeEventListener("scroll", place, true);
          window.removeEventListener("resize", place);
        };
      }, [
        available,
        open,
        pane,
        state,
        query
      ]);
      if (!available) return null;
      const show = () => {
        setSelectionFocus(false);
        triggerRef.current?.focus();
        setQuery("");
        setHighlightedIndex(null);
        if (currentChoice === void 0) paneFocus.current = "drill";
        setPane(currentChoice === void 0 ? "model" : "root");
        setOpen(true);
        reload();
      };
      const changeQuery = (next) => {
        setQuery(next);
        setHighlightedIndex(0);
      };
      const close = (restoreFocus = false) => {
        setOpen(false);
        setPane("root");
        if (restoreFocus) queueMicrotask(() => {
          triggerRef.current?.focus();
        });
      };
      const closeAfterSelection = () => {
        setSelectionFocus(true);
        close(true);
      };
      const drill = (next) => {
        setQuery("");
        setHighlightedIndex(null);
        paneFocus.current = "drill";
        setPane(next);
      };
      /** Leave a drilled pane for the root one, handing the keyboard back to its cell. */
      const back = (from) => {
        paneFocus.current = from;
        setPane("root");
      };
      const moveFocus = (offset) => {
        const items = itemRefs.current.filter((item) => item !== null);
        if (items.length === 0) return;
        const active = items.findIndex((item) => item === document.activeElement);
        items[active === -1 ? offset > 0 ? 0 : items.length - 1 : (active + offset + items.length) % items.length]?.focus();
      };
      const onRootKeyDown = (event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === "Escape" && open) {
          event.preventDefault();
          if (pane !== "root" && currentChoice !== void 0) back(pane);
          else close(true);
          return;
        }
        if (!open) return;
        if (pane === "model" && showSearch && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
          event.preventDefault();
          if (!busy && visibleModels.length > 0) {
            setHighlightedIndex((activeModelIndex + (event.key === "ArrowDown" ? 1 : -1) + visibleModels.length) % visibleModels.length);
            searchRef.current?.focus();
          }
          return;
        }
        if (pane === "model" && showSearch && event.target instanceof HTMLInputElement && (event.key === "Enter" || event.key === "Tab" && !event.shiftKey)) {
          if (event.key === "Tab" && visibleModels.length === 0) return;
          event.preventDefault();
          const highlighted = visibleModels[activeModelIndex];
          if (!busy && highlighted !== void 0) choose(highlighted);
          return;
        }
        if (event.key === "Tab") {
          if (event.shiftKey) {
            event.preventDefault();
            if (pane !== "root" && currentChoice !== void 0) back(pane);
            else close(true);
            return;
          }
          const focused = document.activeElement;
          const rows = itemRefs.current.filter((item) => item !== null);
          if (pane === "mode" && rows.includes(focused) && workerSelectRef.current && !workerSelectRef.current.disabled) {
            event.preventDefault();
            workerSelectRef.current.focus();
            return;
          }
          if (focused instanceof HTMLButtonElement && rows.includes(focused)) {
            event.preventDefault();
            focused.click();
            return;
          }
          if (focused !== triggerRef.current) return;
          event.preventDefault();
          if (pane === "model" && showSearch) {
            setHighlightedIndex(null);
            searchRef.current?.focus();
            return;
          }
          (menuRef.current?.querySelector("[role=\"menuitemradio\"][aria-checked=\"true\"]:not([disabled])") ?? rows.find((item) => !item.disabled))?.focus();
          return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          moveFocus(event.key === "ArrowDown" ? 1 : -1);
        }
      };
      const onBlur = (event) => {
        if (event.relatedTarget instanceof Node && (rootRef.current?.contains(event.relatedTarget) === true || menuRef.current?.contains(event.relatedTarget) === true)) return;
        close();
      };
      const settleSelection = (result) => {
        if (result === void 0) return;
        if (result.ok) {
          if (rootRef.current !== null) closeAfterSelection();
          return;
        }
        const { error } = result;
        toastSeq.current += 1;
        setToast({
          seq: toastSeq.current,
          text: error.code === "session/writer-held" ? t("error.sessionInUse") : t("error.action", { message: `${error.code}: ${error.message}` })
        });
      };
      const submit = (selection) => {
        lastActionRef.current = "select";
        setSelectionFocus(true);
        triggerRef.current?.focus();
        select(selection).then(settleSelection);
      };
      const choose = (selection) => {
        if (state.current?.provider === selection.provider && state.current.model === selection.model) {
          closeAfterSelection();
          return;
        }
        submit(selection);
      };
      const chooseEffort = (effort) => {
        if (state.current === null) return;
        if (effectiveEffort === effort) {
          closeAfterSelection();
          return;
        }
        submit({
          provider: state.current.provider,
          model: state.current.model,
          ...effort === void 0 ? {} : { reasoningEffort: effort }
        });
      };
      const saveComposerPreferences = async (patch) => {
        if (preferencesBusy.current) return;
        preferencesBusy.current = true;
        preferencesRevision.current += 1;
        setSavingPreferences(true);
        try {
          const preferences = await requestComposerPreferences(sessionId, patch);
          setComposerMode(preferences.mode);
          setWorkerModels(preferences.models);
          if (patch.mode !== void 0 && !workerMode(preferences.mode)) closeAfterSelection();
        } catch (error) {
          toastSeq.current += 1;
          setToast({ seq: toastSeq.current, text: t("mode.saveError", { message: String(error.message ?? error) }) });
        } finally {
          preferencesBusy.current = false;
          setSavingPreferences(false);
        }
      };
      const chooseWorkerModel = (key) => {
        const route = choices.find((choice) => workerRouteKey(choice.selection) === key)?.selection;
        if (key !== "" && route === void 0) return;
        void saveComposerPreferences({ workerMode: composerMode, route: route ?? null });
      };
      const workerSelection = workerModels[composerMode];
      const workerModelKey = workerRouteKey(workerSelection);
      const waiting = currentChoice === void 0 && state.status === "loading";
      const modelLabel = waiting ? t("trigger.loading") : currentChoice?.model.name ?? t("trigger.fallback");
      const triggerLabel = effortLabel === void 0 ? modelLabel : `${modelLabel} · ${effortLabel}`;
      const triggerAria = waiting ? t("trigger.loading") : currentChoice === void 0 ? t("trigger.selectAria") : effortLabel === void 0 ? t("trigger.aria", { model: modelLabel }) : t("trigger.ariaEffort", {
        model: modelLabel,
        effort: effortLabel
      });
      const renderModelLabel = (provider, model, placement, selected) => (0, react_jsx_runtime.jsx)("span", {
        "data-provider-id": provider.id,
        "data-model-id": model.id,
        children: renderSlot(labelSeat, {
          provider,
          model,
          placement,
          selected
        }, { fallback: defaultModelLabel(provider, model) })
      });
      let itemIndex = 0;
      let modelIndex = 0;
      const itemRef = () => {
        const at = itemIndex++;
        return (node) => {
          itemRefs.current[at] = node;
        };
      };
      return (0, react_jsx_runtime.jsxs)("div", {
        ref: rootRef,
        className: ModelSelect_module_css_default.root,
        onKeyDown: onRootKeyDown,
        onBlur,
        onMouseDown: (event) => {
          if (event.target instanceof Element && event.target.closest("button") !== null) event.preventDefault();
        },
        children: [
          (0, react_jsx_runtime.jsxs)("button", {
            ref: triggerRef,
            type: "button",
            className: ModelSelect_module_css_default.trigger,
            "aria-label": triggerAria,
            "aria-haspopup": "menu",
            "aria-expanded": open,
            "aria-controls": open ? `${id}-menu` : void 0,
            title: triggerLabel,
            "aria-busy": busy,
            "data-selection-focus": selectionFocus ? "" : void 0,
            onBlur: () => {
              setSelectionFocus(false);
            },
            disabled: locked,
            onClick: () => {
              if (open) close(true);
              else show();
            },
            children: [
              (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconDataOutlineRegular, {
                className: ModelSelect_module_css_default.triggerIcon,
                size: 16
              }),
              (0, react_jsx_runtime.jsx)("span", {
                className: ModelSelect_module_css_default.triggerLabel,
                children: currentChoice === void 0 ? modelLabel : renderModelLabel(currentChoice.group.provider, currentChoice.model, "trigger", true)
              }),
              effortLabel !== void 0 && (0, react_jsx_runtime.jsx)("span", {
                className: ModelSelect_module_css_default.triggerEffort,
                children: effortLabel
              }),
              busy ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: "ongoing" }) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, { className: clsx(ModelSelect_module_css_default.chevron, open && ModelSelect_module_css_default.chevronOpen) })
            ]
          }),
          open && (0, react_dom.createPortal)((0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.MenuSurface, {
            ref: menuRef,
            id: `${id}-menu`,
            className: ModelSelect_module_css_default.menu,
            style: menuPos ?? MEASURE_STYLE,
            role: pane === "model" ? "group" : "menu",
            "aria-label": t("menu.aria"),
            "aria-busy": state.status === "loading" || busy,
            children: (0, react_jsx_runtime.jsxs)("div", {
              className: ModelSelect_module_css_default.twoPane,
              children: [(0, react_jsx_runtime.jsxs)("div", {
                className: ModelSelect_module_css_default.paneRoot,
                children: [(0, react_jsx_runtime.jsxs)("button", {
                ref: itemRef(),
                type: "button",
                role: "menuitem",
                className: ModelSelect_module_css_default.cell,
                "aria-label": `${t("menu.mode")} · ${t(currentMode.labelKey)}`,
                onClick: () => {
                  drill("mode");
                },
                children: [(0, react_jsx_runtime.jsx)("span", {
                  className: ModelSelect_module_css_default.cellLabel,
                  children: t("menu.mode")
                }), (0, react_jsx_runtime.jsx)("span", {
                  className: ModelSelect_module_css_default.cellValue,
                  children: t(currentMode.labelKey)
                }), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, { className: ModelSelect_module_css_default.cellChevron })]
              }), (0, react_jsx_runtime.jsxs)("button", {
                ref: itemRef(),
                type: "button",
                role: "menuitem",
                className: ModelSelect_module_css_default.cell,
                onClick: () => {
                  drill("model");
                },
                children: [
                  (0, react_jsx_runtime.jsx)("span", {
                    className: ModelSelect_module_css_default.cellLabel,
                    children: t("menu.model")
                  }),
                  (0, react_jsx_runtime.jsx)("span", {
                    className: ModelSelect_module_css_default.cellValue,
                    children: currentChoice === void 0 ? modelLabel : renderModelLabel(currentChoice.group.provider, currentChoice.model, "menu", true)
                  }),
                  (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, { className: ModelSelect_module_css_default.cellChevron })
                ]
              }), reasoning !== void 0 && (0, react_jsx_runtime.jsxs)("button", {
                ref: itemRef(),
                type: "button",
                role: "menuitem",
                className: ModelSelect_module_css_default.cell,
                onClick: () => {
                  drill("effort");
                },
                children: [
                  (0, react_jsx_runtime.jsx)("span", {
                    className: ModelSelect_module_css_default.cellLabel,
                    children: t("menu.effort")
                  }),
                  (0, react_jsx_runtime.jsx)("span", {
                    className: ModelSelect_module_css_default.cellValue,
                    children: effortLabel
                  }),
                  (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, { className: ModelSelect_module_css_default.cellChevron })
                ]
              })]
                }),
                pane !== "root" && (0, react_jsx_runtime.jsxs)("div", {
                  className: ModelSelect_module_css_default.paneBody,
                  children: [
                    pane === "model" && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
                showSearch && (0, react_jsx_runtime.jsxs)("div", {
                  className: ModelSelect_module_css_default.searchRow,
                  children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
                    ref: searchRef,
                    className: clsx(ModelSelect_module_css_default.search, query !== "" && ModelSelect_module_css_default.searchWithQuery),
                    type: "text",
                    role: "searchbox",
                    "aria-label": t("search.placeholder"),
                    "aria-controls": `${id}-models`,
                    "aria-activedescendant": activeModelIndex < 0 ? void 0 : `${id}-model-${activeModelIndex}`,
                    placeholder: t("search.placeholder"),
                    value: query,
                    readOnly: busy,
                    onChange: (event) => {
                      changeQuery(event.target.value);
                    }
                  }), query !== "" && (0, react_jsx_runtime.jsx)("button", {
                    type: "button",
                    className: ModelSelect_module_css_default.searchClear,
                    "aria-label": t("search.clear"),
                    disabled: busy,
                    onClick: () => {
                      changeQuery("");
                      searchRef.current?.focus();
                    },
                    children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseFillRegular, {})
                  })]
                }),
                state.status === "loading" && (0, react_jsx_runtime.jsx)("div", {
                  className: ModelSelect_module_css_default.status,
                  children: t("status.loading")
                }),
                state.error !== null && lastActionRef.current === "load" && (0, react_jsx_runtime.jsxs)("div", {
                  className: ModelSelect_module_css_default.error,
                  children: [(0, react_jsx_runtime.jsx)("span", { children: t("error.action", { message: state.error }) }), (0, react_jsx_runtime.jsx)("button", {
                    type: "button",
                    className: ModelSelect_module_css_default.retry,
                    onClick: reload,
                    children: t("retry")
                  })]
                }),
                state.failures.map((failure) => (0, react_jsx_runtime.jsxs)("div", {
                  className: ModelSelect_module_css_default.warning,
                  children: [(0, react_jsx_runtime.jsx)("span", { children: t("warning.groupLoad", {
                    name: failure.id === "deepseek-account" ? t("provider.account") : failure.name,
                    message: failure.message
                  }) }), (0, react_jsx_runtime.jsx)("button", {
                    type: "button",
                    className: ModelSelect_module_css_default.retry,
                    onClick: reload,
                    children: t("retry")
                  })]
                }, failure.id)),
                (0, react_jsx_runtime.jsx)("div", {
                  ref: groupsRef,
                  id: `${id}-models`,
                  className: clsx(ModelSelect_module_css_default.groups, "scrollable"),
                  role: "menu",
                  "aria-label": t("menu.model"),
                  hidden: filteredGroups.length === 0,
                  children: filteredGroups.map((group) => {
                    return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MenuGroup, {
                      label: group.provider.name,
                      children: group.models.map((model) => {
                        const index = modelIndex++;
                        const selected = state.current?.provider === group.id && state.current.model === model.id;
                        return (0, react_jsx_runtime.jsxs)("button", {
                          ref: itemRef(),
                          type: "button",
                          role: "menuitemradio",
                          "aria-checked": selected,
                          id: `${id}-model-${index}`,
                          tabIndex: showSearch ? -1 : 0,
                          onFocus: () => {
                            setHighlightedIndex(index);
                          },
                          "data-highlighted": index === activeModelIndex ? "" : void 0,
                          className: clsx(ModelSelect_module_css_default.option, ModelSelect_module_css_default.modelOption, selected && ModelSelect_module_css_default.selected, index === activeModelIndex && ModelSelect_module_css_default.optionActive),
                          onMouseMove: busy || index === activeModelIndex ? void 0 : () => {
                            if (showSearch) setHighlightedIndex(index);
                            else itemRefs.current[index]?.focus();
                          },
                          title: model.name,
                          disabled: busy,
                          onClick: () => {
                            choose({
                              provider: group.id,
                              model: model.id
                            });
                          },
                          children: [(0, react_jsx_runtime.jsx)("span", {
                            className: ModelSelect_module_css_default.optionCopy,
                            children: (0, react_jsx_runtime.jsx)("span", {
                              className: ModelSelect_module_css_default.modelName,
                              children: renderModelLabel(group.provider, model, "option", selected)
                            })
                          }), (0, react_jsx_runtime.jsx)("span", {
                            className: ModelSelect_module_css_default.check,
                            children: pending?.provider === group.id && pending.model === model.id ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: "ongoing" }) : selected ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutlineRegular, {}) : null
                          })]
                        }, model.id);
                      })
                    }, group.id);
                  })
                }),
                state.status === "ready" && filteredGroups.length === 0 && (0, react_jsx_runtime.jsx)("div", {
                  className: ModelSelect_module_css_default.empty,
                  role: "status",
                  children: t(choices.length === 0 ? "empty.models" : "search.empty")
                })
              ] }),
              pane === "effort" && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [state.error !== null && lastActionRef.current === "load" && (0, react_jsx_runtime.jsxs)("div", {
                className: ModelSelect_module_css_default.error,
                children: [(0, react_jsx_runtime.jsx)("span", { children: t("error.action", { message: state.error }) }), (0, react_jsx_runtime.jsx)("button", {
                  type: "button",
                  className: ModelSelect_module_css_default.retry,
                  onClick: reload,
                  children: t("action.reload")
                })]
              }), effortChoices.length === 0 ? (0, react_jsx_runtime.jsx)("div", {
                className: ModelSelect_module_css_default.empty,
                children: t("empty.efforts")
              }) : effortChoices.map((level) => (0, react_jsx_runtime.jsxs)("button", {
                ref: itemRef(),
                type: "button",
                role: "menuitemradio",
                "aria-checked": effectiveEffort === level.effort,
                className: clsx(ModelSelect_module_css_default.option, effectiveEffort === level.effort && ModelSelect_module_css_default.selected),
                disabled: busy,
                onClick: () => {
                  chooseEffort(level.effort);
                },
                children: [(0, react_jsx_runtime.jsx)("span", {
                  className: ModelSelect_module_css_default.optionCopy,
                  children: (0, react_jsx_runtime.jsx)("span", {
                    className: ModelSelect_module_css_default.modelName,
                    children: level.label
                  })
                }), (0, react_jsx_runtime.jsx)("span", {
                  className: ModelSelect_module_css_default.check,
                  children: pending !== null && pending.provider === state.current?.provider && pending.model === state.current.model && pending.reasoningEffort === level.effort ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: "ongoing" }) : effectiveEffort === level.effort ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutlineRegular, {}) : null
                })]
              }, level.key))] }),
              pane === "mode" && (0, react_jsx_runtime.jsxs)("div", {
                className: ModelSelect_module_css_default.groups,
                children: [(0, react_jsx_runtime.jsx)("div", {
                role: "menu",
                "aria-label": t("menu.mode"),
                children: COMPOSER_MODES.map((mode) => (0, react_jsx_runtime.jsxs)("button", {
                  ref: itemRef(),
                  type: "button",
                  role: "menuitemradio",
                  "aria-checked": currentMode.id === mode.id,
                  title: t(mode.descKey),
                  className: clsx(ModelSelect_module_css_default.option, currentMode.id === mode.id && ModelSelect_module_css_default.selected),
                  onClick: () => {
                    void saveComposerPreferences({ mode: mode.id });
                  },
                  disabled: savingPreferences,
                  children: [composerModeIcon(mode.icon), (0, react_jsx_runtime.jsx)("span", {
                    className: ModelSelect_module_css_default.optionCopy,
                    children: (0, react_jsx_runtime.jsx)("span", {
                      className: ModelSelect_module_css_default.modelName,
                      children: t(mode.labelKey)
                    })
                  }), (0, react_jsx_runtime.jsx)("span", {
                    className: ModelSelect_module_css_default.check,
                    children: currentMode.id === mode.id ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutlineRegular, {}) : null
                  })]
                }, mode.id))
                }), workerMode(composerMode) && (0, react_jsx_runtime.jsxs)("label", {
                  className: "dsh-worker-model-picker",
                  children: [t("mode.workerModel"), (0, react_jsx_runtime.jsxs)("select", {
                    ref: workerSelectRef,
                    value: workerModelKey,
                    disabled: savingPreferences,
                    onKeyDown: (event) => event.stopPropagation(),
                    onChange: (event) => chooseWorkerModel(event.currentTarget.value),
                    children: [(0, react_jsx_runtime.jsx)("option", { value: "", children: t("mode.inheritModel") }),
                      workerSelection && !choices.some((choice) => workerRouteKey(choice.selection) === workerModelKey) && (0, react_jsx_runtime.jsx)("option", {
                        value: workerModelKey,
                        children: `${workerSelection.provider} / ${workerSelection.model}`
                      }), ...groups.filter((group) => group.models.length > 0).map((group) => (0, react_jsx_runtime.jsx)("optgroup", {
                        label: group.provider.name,
                        children: group.models.map((model) => (0, react_jsx_runtime.jsx)("option", {
                          value: workerRouteKey({ provider: group.id, model: model.id }),
                          children: model.name
                        }, model.id))
                      }, group.id))]
                  })]
                })]
              })
                ]
              })]
            })
          }), document.body),
          toast !== null && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Toast, {
            text: toast.text,
            icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutlineRegular, {}),
            anchor: rootRef.current?.closest("[data-composer-card]") ?? null,
            onDone: () => {
              setToast(null);
            }
          }, toast.seq)
        ]
      });
    }
    /**
    * `model` namespace dictionaries.
    *
    * `trigger.selectAria` intentionally matches `trigger.fallback` but remains a
    * separate key: the visible fallback label and the accessible name of
    * an unset trigger are free to diverge per locale, and folding it into
    * `trigger.aria` would announce the degenerate "Select model, current Select
    * model".
    */
    /** Simplified Chinese dictionary (the key-set source of truth). */
    const zh = {
      "provider.account": "DeepSeek 账号",
      "option.loadError": "目录加载失败：{message}",
      "trigger.fallback": "请选择模型",
      "trigger.loading": "正在加载模型…",
      "trigger.selectAria": "请选择模型",
      "trigger.aria": "选择模型，当前 {model}",
      "trigger.ariaEffort": "选择模型，当前 {model}，推理等级 {effort}",
      "menu.aria": "模式、模型与推理强度",
      "menu.mode": "模式",
      "menu.model": "模型",
      "menu.effort": "推理强度",
      "mode.quick": "快速",
      "mode.quick.desc": "直接回答，不调用工具。适合简单提问。",
      "mode.solo": "单体",
      "mode.solo.desc": "单个智能体，端到端完成。适合目标明确的任务。",
      "mode.delegate": "主从",
      "mode.delegate.desc": "每轮启动一个子代理协助分析，由主代理核实并执行。",
      "mode.cluster": "集群",
      "mode.cluster.desc": "后台先拆分任务，再按需要启动子代理；也可在消息里指定数量。",
      "mode.workerModel": "子代理模型",
      "mode.inheritModel": "跟随主模型",
      "mode.saveError": "模式设置未保存：{message}",
      "effort.providerDefault": "Default",
      "status.loading": "正在刷新模型列表…",
      "error.action": "模型操作失败：{message}",
      "error.sessionInUse": "当前会话已被占用，可能是其他正在运行的 DSH 导致的（如其他 dsh web、桌面端），请退出其他正在运行的 DSH 后重试。",
      "action.reload": "重新加载",
      "warning.groupLoad": "{name} 加载失败：{message}",
      "search.placeholder": "搜索模型…",
      "search.clear": "清除搜索",
      "search.empty": "没有匹配的模型。",
      "empty.models": "暂无可用模型",
      "empty.efforts": "当前模型未提供推理等级。"
    };
    /** English dictionary, checked complete against the zh key set. */
    const en = {
      "provider.account": "DeepSeek Account",
      "option.loadError": "Catalog failed to load: {message}",
      "trigger.fallback": "Select model",
      "trigger.loading": "Loading models…",
      "trigger.selectAria": "Select model",
      "trigger.aria": "Select model, current {model}",
      "trigger.ariaEffort": "Select model, current {model}, reasoning effort {effort}",
      "menu.aria": "Mode, model and reasoning effort",
      "menu.mode": "Mode",
      "menu.model": "Model",
      "menu.effort": "Reasoning",
      "mode.quick": "Quick",
      "mode.quick.desc": "Direct answers, no tools. For simple questions.",
      "mode.solo": "Solo",
      "mode.solo.desc": "One agent, end to end. For focused tasks.",
      "mode.delegate": "Delegate",
      "mode.delegate.desc": "Start one subagent per turn to assist the lead agent.",
      "mode.cluster": "Cluster",
      "mode.cluster.desc": "Plan independent work before starting subagents. The user can also specify a count.",
      "mode.workerModel": "Subagent model",
      "mode.inheritModel": "Follow the lead model",
      "mode.saveError": "Could not save mode preferences: {message}",
      "effort.providerDefault": "Default",
      "status.loading": "Refreshing model list…",
      "error.action": "Model operation failed: {message}",
      "error.sessionInUse": "This session is already in use, possibly by another running DSH instance (such as dsh web or the desktop app). Quit other running DSH instances and try again.",
      "action.reload": "Reload",
      "warning.groupLoad": "{name} failed to load: {message}",
      "search.placeholder": "Search models…",
      "search.clear": "Clear search",
      "search.empty": "No matching models.",
      "empty.models": "No models available.",
      "empty.efforts": "This model provides no reasoning effort levels."
    };

    const namespace = 'ai4s-composer-menu';
    const seat = 'conversation.input.model';
    const inject = ['locale', 'slots', 'sessions', 'modelDirectories', 'remote', 'remote.session'];

    function defaultModelLabel(provider, model) {
      if (model.id !== 'deepseek-flash' || model.name !== 'DeepSeek-V4.1-Flash'
          || (provider.id !== 'deepseek-account' && provider.id !== 'deepseek-official')) return model.name;
      return react_jsx_runtime.jsxs('span', {
        className: 'ai4s-release-label',
        children: [react_jsx_runtime.jsx('span', { children: model.name }), ' ',
          react_jsx_runtime.jsx(_deepseek_ai_dsh_client_ui_primitives.Tag, { tone: 'info', children: '1017' })],
      });
    }

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(namespace, { zh, en }), 'AI4S model menu translations');
      ctx.effect(() => {
        const style = document.createElement('style');
        style.dataset.pluginCss = namespace;
        style.textContent = `${menuStyles}\n.ai4s-release-label{vertical-align:baseline;white-space:nowrap;align-items:center;gap:4px;display:inline-flex}`;
        document.head.appendChild(style);
        return () => style.remove();
      }, 'AI4S model menu styles');
      ctx.slots.inject(seat, () => ctx.slots.register({
        name: seat,
        priority: -10,
        locale: namespace,
        children: { [labelSeat]: { kind: 'single', scope: 'session', inline: true } },
        inject(sessionId) {
          const directory = ctx.modelDirectories.directoryFor(sessionId);
          const available = ctx.sessions.subagentAddress(sessionId) === undefined;
          return {
            sessionId,
            available,
            directory: directory.store,
            load() { if (available) directory.load().catch(() => {}); },
            select: (selection) => available ? directory.select(selection) : Promise.resolve(undefined),
          };
        },
      }, (props) => react_jsx_runtime.jsx(ModelSelect, props, props.sessionId)));
    }

    return { apply, inject };
  },
});
