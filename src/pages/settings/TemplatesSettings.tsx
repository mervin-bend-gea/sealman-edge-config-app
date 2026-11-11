import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { TrashIcon } from "@heroicons/react/24/outline";
import { TransferList } from "@/components/settings/TransferList";
import { edgeConfigApiHooks } from "@/api/edgeConfig/edgeConfigApiHooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import PageTitle from "@/components/Typography/PageTitle";
import { getErrorMessage } from "@/lib/errors";

function TemplateVariableRow({
  name,
  value,
  onSave,
  onDelete,
  saving,
}: {
  name: string;
  value: string;
  onSave: (name: string, value: string) => void;
  onDelete: (name: string) => void;
  saving: boolean;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const isDirty = draft !== value;

  return (
    <tr className="bg-background hover:bg-muted/40 transition-colors border-b last:border-b-0">
      <td className="px-4 py-3 font-mono text-sm text-muted-foreground">{name}</td>
      <td className="px-3 py-2">
        <Input
          type={name.includes("password") || name.includes("encoded") ? "password" : "text"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        <Button
          size="sm"
          onClick={() => onSave(name, draft)}
          disabled={!isDirty || saving}
          className="mr-2"
        >
          Save
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(name)}
          disabled={saving}
          className="text-muted-foreground hover:text-destructive"
          title={`Delete ${name}`}
        >
          <TrashIcon />
        </Button>
      </td>
    </tr>
  );
}

function DeviceTemplateVariablesSection() {
  const { variablesQuery, setVariableMutation, deleteVariableMutation } =
    edgeConfigApiHooks.useDeviceTemplateVariables();

  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");

  const variables = variablesQuery.data ?? {};

  const handleSave = (name: string, value: string) => {
    setVariableMutation.mutate(
      { name, value },
      {
        onError: () => toast.error(`Could not save "${name}"`),
      }
    );
  };

  const handleDelete = (name: string) => {
    deleteVariableMutation.mutate(name, {
      onError: () => toast.error(`Could not delete "${name}"`),
    });
  };

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    if (name in variables) {
      toast.error(`"${name}" already exists`);
      return;
    }
    setVariableMutation.mutate(
      { name, value: newValue },
      {
        onSuccess: () => {
          setNewName("");
          setNewValue("");
        },
        onError: () => toast.error(`Could not add "${name}"`),
      }
    );
  };

  if (variablesQuery.isLoading) return <LoadingState label="Loading template variables..." />;
  if (variablesQuery.isError) return <ErrorState title="Could not load template variables" message={getErrorMessage(variablesQuery.error)} onRetry={() => variablesQuery.refetch()} />;

  const saving = setVariableMutation.isPending || deleteVariableMutation.isPending;

  return (
    <div className="bg-card border rounded-lg p-4 space-y-4">
      <p className="text-sm text-muted-foreground">
        These variables are applied to every new device during creation.
      </p>

      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead>
            <tr className="bg-gradient-to-r from-slate-100 to-slate-50">
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground border-b w-1/3">
                Variable
              </th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground border-b">
                Value
              </th>
              <th className="px-4 py-3 border-b" />
            </tr>
          </thead>
          <tbody>
            {Object.entries(variables).map(([name, value]) => (
              <TemplateVariableRow
                key={name}
                name={name}
                value={value}
                onSave={handleSave}
                onDelete={handleDelete}
                saving={saving}
              />
            ))}
            <tr className="bg-muted/20">
              <td className="px-4 py-3">
                <Input
                  placeholder="New variable name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </td>
              <td className="px-3 py-2">
                <Input
                  placeholder="Value"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                />
              </td>
              <td className="px-3 py-2 text-right">
                <Button
                  size="sm"
                  onClick={handleAdd}
                  disabled={!newName.trim() || saving}
                >
                  Add
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

type TemplateInfo = { id: number; name: string; selected: boolean };

function SelectedTemplatesSection() {
  const { templatesQuery, saveTemplatesMutation } = edgeConfigApiHooks.useDeviceTemplates();

  if (templatesQuery.isLoading) return <LoadingState label="Loading templates..." />;
  if (templatesQuery.isError) return <ErrorState title="Could not load templates" message={getErrorMessage(templatesQuery.error)} onRetry={() => templatesQuery.refetch()} />;

  const templates: TemplateInfo[] = templatesQuery.data || [];
  const selectedTemplates = templates.filter((t) => t.selected).map((t) => t.name);
  const availableTemplates = templates.filter((t) => !t.selected).map((t) => t.name);

  const handleAdd = (value: string) => {
    const updated = [...selectedTemplates, value];
    saveTemplatesMutation.mutate(updated, {
      onSuccess: () => templatesQuery.refetch(),
    });
  };

  const handleRemove = (value: string) => {
    const updated = selectedTemplates.filter((t: string) => t !== value);
    saveTemplatesMutation.mutate(updated, {
      onSuccess: () => templatesQuery.refetch(),
    });
  };

  return (
    <TransferList
      title=""
      selectedItems={selectedTemplates}
      availableItems={availableTemplates}
      onAdd={handleAdd}
      onRemove={handleRemove}
    />
  );
}

export default function TemplatesSettings() {
  return (
    <div className="space-y-10">
      <div className="space-y-6">
        <PageTitle
          title="Selected SEMS Templates"
          description="SEMS templates that are applied to newly created devices."
        />
        <SelectedTemplatesSection />
      </div>

      <div className="space-y-6">
        <PageTitle
          title="SEMS Template Variables"
          description="Values made available to the SEMS templates when a device is created."
        />
        <DeviceTemplateVariablesSection />
      </div>
    </div>
  );
}
