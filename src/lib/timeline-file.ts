import { parseImportJSON } from '@/features/io/import-json';
import type { Timeline, TimelineExport, TimelineVersion } from '@/lib/types';

interface PickerType {
  description?: string;
  accept: Record<string, string[]>;
}

interface OpenPickerOptions {
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
  types?: PickerType[];
}

type WindowWithFileAccess = Window & {
  showOpenFilePicker?: (options?: OpenPickerOptions) => Promise<FileSystemFileHandle[]>;
};

export type EditorSession =
  | {
      mode: 'indexeddb';
      timelineId: string;
    }
  | {
      mode: 'file';
      fileHandle: FileSystemFileHandle;
      fileName: string;
      versions: TimelineVersion[];
    };

export interface DirectEditNavigationState {
  directEdit?: {
    timeline: Timeline;
    fileHandle: FileSystemFileHandle;
    fileName: string;
    versions: TimelineVersion[];
  };
}

const JSON_FILE_TYPES: PickerType[] = [
  {
    description: 'Chronoline JSON',
    accept: {
      'application/json': ['.json'],
    },
  },
];

export function supportsFileSystemAccess() {
  if (typeof window === 'undefined') return false;
  return typeof (window as WindowWithFileAccess).showOpenFilePicker === 'function';
}

export function buildTimelineExportEnvelope(
  timeline: Timeline,
  versions: TimelineVersion[] = []
): TimelineExport {
  return {
    $schema: 'project-timeline/v1',
    exportedAt: new Date().toISOString(),
    timeline,
    versions,
  };
}

export async function pickTimelineFileForDirectEdit(): Promise<NonNullable<DirectEditNavigationState['directEdit']>> {
  const picker = (window as WindowWithFileAccess).showOpenFilePicker;
  if (!picker) {
    throw new Error('This browser does not support direct file editing.');
  }

  const [fileHandle] = await picker({
    multiple: false,
    excludeAcceptAllOption: false,
    types: JSON_FILE_TYPES,
  });

  if (!fileHandle) {
    throw new Error('No file selected.');
  }

  const file = await fileHandle.getFile();
  const parsed = parseImportJSON(await file.text());

  return {
    timeline: parsed.timeline,
    fileHandle,
    fileName: file.name,
    versions: parsed.versions,
  };
}

export async function saveTimelineToFile(options: {
  timeline: Timeline;
  fileHandle: FileSystemFileHandle;
  versions?: TimelineVersion[];
}) {
  const writable = await options.fileHandle.createWritable();
  await writable.write(JSON.stringify(buildTimelineExportEnvelope(options.timeline, options.versions ?? []), null, 2));
  await writable.close();
}