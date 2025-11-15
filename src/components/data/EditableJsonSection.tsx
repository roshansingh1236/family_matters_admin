import React, { useState } from 'react';
import Button from '../base/Button';
import DataSection from './DataSection';

type EditableJsonSectionProps = {
  title: string;
  data?: Record<string, unknown> | null;
  emptyMessage?: string;
  description?: string;
  onSave: (value: Record<string, unknown>) => Promise<void> | void;
};

const prettify = (value: Record<string, unknown> | null | undefined) => {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch (error) {
    return '{}';
  }
};

const EditableJsonSection: React.FC<EditableJsonSectionProps> = ({
  title,
  data,
  emptyMessage,
  description,
  onSave
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [jsonValue, setJsonValue] = useState(prettify(data));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isEmpty = !data || Object.keys(data).length === 0;

  const beginEdit = () => {
    setJsonValue(prettify(data));
    setErrorMessage(null);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setErrorMessage(null);
    setJsonValue(prettify(data));
  };

  const handleSave = async () => {
    try {
      const parsedValue = jsonValue.trim() === '' ? {} : JSON.parse(jsonValue);

      if (parsedValue === null || Array.isArray(parsedValue) || typeof parsedValue !== 'object') {
        setErrorMessage('Please provide a valid JSON object.');
        return;
      }

      setIsSaving(true);
      await onSave(parsedValue as Record<string, unknown>);
      setIsSaving(false);
      setIsEditing(false);
      setErrorMessage(null);
    } catch (error) {
      console.error(error);
      setIsSaving(false);
      setErrorMessage('Unable to parse the JSON. Please ensure it is valid.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          {description && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
        </div>
        {!isEditing ? (
          isEmpty ? (
            <Button size="sm" color="blue" onClick={beginEdit}>
              <i className="ri-add-line text-sm"></i>
              Add Details
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={beginEdit}>
              <i className="ri-edit-line text-sm"></i>
              Edit
            </Button>
          )
        ) : null}
      </div>

      {isEditing ? (
        <>
          <textarea
            value={jsonValue}
            onChange={(event) => setJsonValue(event.target.value)}
            rows={14}
            spellCheck={false}
            className="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 font-mono text-sm text-gray-800 dark:text-gray-100 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder={`{\n  "example": "value"\n}`}
          />
          {errorMessage && <p className="text-xs font-medium text-red-500 dark:text-red-400">{errorMessage}</p>}
          <div className="flex items-center justify-end gap-3">
            <Button size="sm" variant="outline" onClick={cancelEdit} disabled={isSaving}>
              Cancel
            </Button>
            <Button size="sm" color="blue" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <i className="ri-loader-4-line animate-spin text-sm"></i>
                  Saving...
                </>
              ) : (
                <>
                  <i className="ri-save-3-line text-sm"></i>
                  Save
                </>
              )}
            </Button>
          </div>
        </>
      ) : (
        <DataSection title="" data={data ?? undefined} emptyMessage={emptyMessage} />
      )}
    </div>
  );
};

export default EditableJsonSection;

