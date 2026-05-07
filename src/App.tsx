import { useCallback, useEffect, useMemo, useState } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { PipelineSettings } from './components/PipelineSettings';
import { YamlEditor } from './components/YamlEditor';
import { ValidateButton } from './components/ValidateButton';
import { ValidationResultView } from './components/ValidationResult';
import { TriggerSelector } from './components/TriggerSelector';
import { CICDVariablesPanel } from './components/CICDVariablesPanel';
import { SimulationResultView } from './components/SimulationResult';
import { SimulationSuccessBanner } from './components/SimulationBanner';
import { ActiveVariablesPanel } from './components/ActiveVariablesPanel';
import { NeedsErrorBanner } from './components/NeedsErrorBanner';
import { VersionUpdateBanner } from './components/VersionUpdateBanner';
import { DEFAULT_SCHEMA_VERSION, SCHEMA_VERSIONS } from './schemas.config';
import { validateYaml } from './lib/validator';
import { simulate } from './lib/simulator';
import {
  loadDefaultBranch,
  loadDismissedVersionWarning,
  loadGitlabVersion,
  loadScopedVariables,
  loadYamlDraft,
  saveDefaultBranch,
  saveDismissedVersionWarning,
  saveGitlabVersion,
  saveScopedVariables,
  saveYamlDraft,
} from './lib/scopedVarStorage';
import type {
  CustomVariable,
  EditorTarget,
  SimulationResult,
  TriggerInputs,
  TriggerType,
  ValidationResult,
} from './types';
import './App.css';

const DEFAULT_YAML = ``;

const DEFAULT_TRIGGER: TriggerType = 'push';
const DEFAULT_DEFAULT_BRANCH = 'main';

const LATEST_VERSION = SCHEMA_VERSIONS[0].label;

function resolveInitialVersion(): string {
  const stored = loadGitlabVersion();
  if (stored && SCHEMA_VERSIONS.some((v) => v.label === stored)) return stored;
  return DEFAULT_SCHEMA_VERSION;
}

function resolveInitialDefaultBranch(): string {
  return loadDefaultBranch() ?? DEFAULT_DEFAULT_BRANCH;
}

export function App() {
  const [yamlText, setYamlText] = useState<string>(() => loadYamlDraft() ?? DEFAULT_YAML);
  const [version, setVersion] = useState<string>(resolveInitialVersion);
  const [validation, setValidation] = useState<ValidationResult>({ status: 'idle' });
  const [simResult, setSimResult] = useState<SimulationResult>({ status: 'idle' });
  const [simContext, setSimContext] = useState<{
    triggerType: TriggerType;
    triggerInputs: TriggerInputs;
  } | null>(null);
  const [triggerType, setTriggerType] = useState<TriggerType>(DEFAULT_TRIGGER);
  const [triggerInputs, setTriggerInputs] = useState<TriggerInputs>(() => {
    const branch = resolveInitialDefaultBranch();
    return { defaultBranch: branch, branchName: branch };
  });
  const [scopedVars, setScopedVars] = useState<CustomVariable[]>(() => loadScopedVariables());
  const [customVars, setCustomVars] = useState<CustomVariable[]>([]);
  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(null);
  const [validating, setValidating] = useState(false);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(() =>
    loadDismissedVersionWarning(),
  );

  useEffect(() => {
    saveScopedVariables(scopedVars);
  }, [scopedVars]);
  useEffect(() => {
    saveYamlDraft(yamlText);
  }, [yamlText]);
  useEffect(() => {
    saveGitlabVersion(version);
  }, [version]);
  useEffect(() => {
    saveDefaultBranch(triggerInputs.defaultBranch);
  }, [triggerInputs.defaultBranch]);

  const showVersionWarning = useMemo(() => {
    if (version === LATEST_VERSION) return false;
    return dismissedVersion !== LATEST_VERSION;
  }, [version, dismissedVersion]);

  const onYamlChange = useCallback((next: string) => {
    setYamlText(next);
  }, []);

  const onVersionChange = useCallback((next: string) => {
    setVersion(next);
  }, []);

  const onTriggerTypeChange = useCallback((next: TriggerType) => {
    setTriggerType(next);
  }, []);

  const onTriggerInputsChange = useCallback((next: TriggerInputs) => {
    setTriggerInputs(next);
  }, []);

  const onDefaultBranchChange = useCallback((next: string) => {
    setTriggerInputs((prev) => ({ ...prev, defaultBranch: next }));
  }, []);

  const onCustomVarsChange = useCallback((next: CustomVariable[]) => {
    setCustomVars(next);
  }, []);

  const handleDismissVersionWarning = useCallback(() => {
    setDismissedVersion(LATEST_VERSION);
    saveDismissedVersionWarning(LATEST_VERSION);
  }, []);

  const handleUpgradeVersion = useCallback(() => {
    setVersion(LATEST_VERSION);
  }, []);

  const handleValidate = useCallback(async () => {
    setValidating(true);
    try {
      const result = await validateYaml(yamlText, version);
      setValidation(result);

      if (result.status === 'valid') {
        setSimResult(simulate(result.parsed, triggerType, triggerInputs, customVars, scopedVars));
        setSimContext({ triggerType, triggerInputs });
      } else {
        setSimResult({ status: 'idle' });
        setSimContext(null);
      }
    } finally {
      setValidating(false);
    }
  }, [yamlText, version, triggerType, triggerInputs, customVars, scopedVars]);

  const onErrorClick = useCallback((line: number) => {
    setEditorTarget({ line });
  }, []);

  const showValidationBanner =
    validation.status === 'empty' ||
    validation.status === 'yaml_error' ||
    validation.status === 'invalid';

  return (
    <div className="app">
      {showVersionWarning && (
        <VersionUpdateBanner
          selectedVersion={version}
          latestVersion={LATEST_VERSION}
          onDismiss={handleDismissVersionWarning}
          onUpgrade={handleUpgradeVersion}
        />
      )}

      <div className="app-container">
        <div className="app-corner-settings">
          <PipelineSettings
            version={version}
            onVersionChange={onVersionChange}
            defaultBranch={triggerInputs.defaultBranch}
            onDefaultBranchChange={onDefaultBranchChange}
          />
        </div>

        <Header />

        <CICDVariablesPanel
          scopedVariables={scopedVars}
          customVariables={customVars}
          onScopedChange={setScopedVars}
          onCustomChange={onCustomVarsChange}
        />

        <section className="top-bar">
          <div className="top-bar-source">
            <TriggerSelector
              triggerType={triggerType}
              inputs={triggerInputs}
              onTypeChange={onTriggerTypeChange}
              onInputsChange={onTriggerInputsChange}
            />
            <ValidateButton onValidate={handleValidate} busy={validating} />
          </div>
        </section>

        <YamlEditor
          value={yamlText}
          onChange={onYamlChange}
          target={editorTarget}
          onTargetApplied={() => {
            setEditorTarget(null);
          }}
        />
        {showValidationBanner && (
          <ValidationResultView result={validation} onErrorClick={onErrorClick} />
        )}

        <section className="simulation-section">
          {simResult.status === 'complete' && simContext && (
            <SimulationSuccessBanner
              triggerType={simContext.triggerType}
              inputs={simContext.triggerInputs}
            />
          )}
          {simResult.status === 'complete' && <NeedsErrorBanner errors={simResult.needsErrors} />}
          <SimulationResultView result={simResult} />
          {simResult.status === 'complete' && (
            <ActiveVariablesPanel variables={simResult.activeVariables} />
          )}
        </section>

        <Footer />
      </div>
    </div>
  );
}
