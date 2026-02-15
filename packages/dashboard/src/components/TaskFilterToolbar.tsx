'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { TaskFilters, TaskPriority, TaskStatus, TaskSortField, TaskList, SavedFilter } from '@taskinfa/shared';

interface TaskFilterToolbarProps {
  filters: TaskFilters;
  onFiltersChange: (filters: TaskFilters) => void;
  taskLists: TaskList[];
  allLabels: string[];
  savedFilters: SavedFilter[];
  onSaveFilter: (name: string) => void;
  onDeleteSavedFilter: (id: string) => void;
}

const priorityOptions: { value: TaskPriority; label: string }[] = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' },
];

const sortOptions: { value: TaskSortField; label: string }[] = [
  { value: 'order', label: 'Default Order' },
  { value: 'created_at', label: 'Created Date' },
  { value: 'updated_at', label: 'Updated Date' },
  { value: 'priority', label: 'Priority' },
  { value: 'title', label: 'Title' },
];

export default function TaskFilterToolbar({
  filters,
  onFiltersChange,
  taskLists,
  allLabels,
  savedFilters,
  onSaveFilter,
  onDeleteSavedFilter,
}: TaskFilterToolbarProps) {
  const [searchValue, setSearchValue] = useState(filters.q || '');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [saveFilterName, setSaveFilterName] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const filterPanelRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (searchValue !== (filters.q || '')) {
        onFiltersChange({ ...filters, q: searchValue || undefined });
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchValue]); // filters/onFiltersChange intentionally excluded - only trigger on search value changes

  // Close filter panel on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterPanelRef.current && !filterPanelRef.current.contains(e.target as Node)) {
        setIsFilterPanelOpen(false);
      }
    };
    if (isFilterPanelOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isFilterPanelOpen]);

  const updateFilter = useCallback((key: keyof TaskFilters, value: string | undefined) => {
    onFiltersChange({ ...filters, [key]: value || undefined });
  }, [filters, onFiltersChange]);

  const clearAllFilters = () => {
    setSearchValue('');
    onFiltersChange({});
  };

  const activeFilterCount = [
    filters.q,
    filters.priority,
    filters.status,
    filters.task_list_id,
    filters.label,
    filters.assignee,
    filters.created_after,
    filters.created_before,
  ].filter(Boolean).length;

  const hasNonDefaultSort = filters.sort && filters.sort !== 'order';

  const handleSaveFilter = () => {
    if (saveFilterName.trim()) {
      onSaveFilter(saveFilterName.trim());
      setSaveFilterName('');
      setIsSaveDialogOpen(false);
    }
  };

  const applySavedFilter = (savedFilter: SavedFilter) => {
    try {
      const parsed = JSON.parse(savedFilter.filters) as TaskFilters;
      setSearchValue(parsed.q || '');
      onFiltersChange(parsed);
    } catch {
      // ignore invalid JSON
    }
    setIsFilterPanelOpen(false);
  };

  return (
    <div className="mb-4 space-y-2">
      {/* Top row: Search + Filter button + Sort */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-terminal-muted pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search tasks..."
            className="input-field pl-10 w-full"
          />
          {searchValue && (
            <button
              onClick={() => { setSearchValue(''); updateFilter('q', undefined); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-terminal-muted hover:text-terminal-text"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Filter Button */}
        <div className="relative" ref={filterPanelRef}>
          <button
            onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
            className={`btn-secondary flex items-center gap-2 ${activeFilterCount > 0 ? 'border-terminal-blue text-terminal-blue' : ''}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span className="bg-terminal-blue text-terminal-bg text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Filter Panel Dropdown */}
          {isFilterPanelOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-terminal-surface border border-terminal-border rounded-lg shadow-xl z-50 p-4 space-y-4">
              {/* Saved Filters */}
              {savedFilters.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-terminal-muted uppercase tracking-wider mb-2 block">
                    Saved Filters
                  </label>
                  <div className="space-y-1">
                    {savedFilters.map((sf) => (
                      <div key={sf.id} className="flex items-center justify-between group">
                        <button
                          onClick={() => applySavedFilter(sf)}
                          className="text-sm text-terminal-text hover:text-terminal-blue truncate flex-1 text-left py-1"
                        >
                          {sf.name}
                        </button>
                        <button
                          onClick={() => onDeleteSavedFilter(sf.id)}
                          className="text-terminal-muted hover:text-terminal-red opacity-0 group-hover:opacity-100 p-1"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="border-b border-terminal-border mt-2" />
                </div>
              )}

              {/* Status */}
              <div>
                <label className="text-xs font-medium text-terminal-muted uppercase tracking-wider mb-1 block">Status</label>
                <select
                  value={filters.status || ''}
                  onChange={(e) => updateFilter('status', e.target.value)}
                  className="input-field w-full text-sm"
                >
                  <option value="">All Statuses</option>
                  {statusOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="text-xs font-medium text-terminal-muted uppercase tracking-wider mb-1 block">Priority</label>
                <select
                  value={filters.priority || ''}
                  onChange={(e) => updateFilter('priority', e.target.value)}
                  className="input-field w-full text-sm"
                >
                  <option value="">All Priorities</option>
                  {priorityOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Project */}
              {taskLists.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-terminal-muted uppercase tracking-wider mb-1 block">Project</label>
                  <select
                    value={filters.task_list_id || ''}
                    onChange={(e) => updateFilter('task_list_id', e.target.value)}
                    className="input-field w-full text-sm"
                  >
                    <option value="">All Projects</option>
                    {taskLists.map((tl) => (
                      <option key={tl.id} value={tl.id}>{tl.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Label */}
              {allLabels.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-terminal-muted uppercase tracking-wider mb-1 block">Label</label>
                  <select
                    value={filters.label || ''}
                    onChange={(e) => updateFilter('label', e.target.value)}
                    className="input-field w-full text-sm"
                  >
                    <option value="">All Labels</option>
                    {allLabels.map((label) => (
                      <option key={label} value={label}>{label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Date Range */}
              <div>
                <label className="text-xs font-medium text-terminal-muted uppercase tracking-wider mb-1 block">Created After</label>
                <input
                  type="date"
                  value={filters.created_after || ''}
                  onChange={(e) => updateFilter('created_after', e.target.value)}
                  className="input-field w-full text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-terminal-muted uppercase tracking-wider mb-1 block">Created Before</label>
                <input
                  type="date"
                  value={filters.created_before || ''}
                  onChange={(e) => updateFilter('created_before', e.target.value)}
                  className="input-field w-full text-sm"
                />
              </div>

              {/* Panel Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-terminal-border">
                <button
                  onClick={clearAllFilters}
                  className="text-sm text-terminal-muted hover:text-terminal-text"
                >
                  Clear All
                </button>
                {activeFilterCount > 0 && (
                  <button
                    onClick={() => setIsSaveDialogOpen(true)}
                    className="text-sm text-terminal-blue hover:text-terminal-text"
                  >
                    Save Filter
                  </button>
                )}
              </div>

              {/* Save Filter Dialog */}
              {isSaveDialogOpen && (
                <div className="border-t border-terminal-border pt-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={saveFilterName}
                      onChange={(e) => setSaveFilterName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveFilter()}
                      placeholder="Filter name..."
                      className="input-field flex-1 text-sm"
                      autoFocus
                    />
                    <button onClick={handleSaveFilter} className="btn-primary text-sm px-3">
                      Save
                    </button>
                    <button
                      onClick={() => { setIsSaveDialogOpen(false); setSaveFilterName(''); }}
                      className="btn-secondary text-sm px-3"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sort Control */}
        <div className="flex items-center gap-1">
          <select
            value={filters.sort || 'order'}
            onChange={(e) => updateFilter('sort', e.target.value === 'order' ? undefined : e.target.value)}
            className="input-field text-sm py-2"
          >
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {hasNonDefaultSort && (
            <button
              onClick={() => updateFilter('order', filters.order === 'desc' ? 'asc' : 'desc')}
              className="btn-secondary p-2"
              title={`Sort ${filters.order === 'desc' ? 'ascending' : 'descending'}`}
            >
              <svg className={`w-4 h-4 transition-transform ${filters.order === 'desc' ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Active Filter Badges */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-terminal-muted">Active filters:</span>
          {filters.q && (
            <FilterBadge label={`Search: "${filters.q}"`} onRemove={() => { setSearchValue(''); updateFilter('q', undefined); }} />
          )}
          {filters.status && (
            <FilterBadge label={`Status: ${filters.status.replace('_', ' ')}`} onRemove={() => updateFilter('status', undefined)} />
          )}
          {filters.priority && (
            <FilterBadge label={`Priority: ${filters.priority}`} onRemove={() => updateFilter('priority', undefined)} />
          )}
          {filters.task_list_id && (
            <FilterBadge
              label={`Project: ${taskLists.find(t => t.id === filters.task_list_id)?.name || filters.task_list_id}`}
              onRemove={() => updateFilter('task_list_id', undefined)}
            />
          )}
          {filters.label && (
            <FilterBadge label={`Label: ${filters.label}`} onRemove={() => updateFilter('label', undefined)} />
          )}
          {filters.assignee && (
            <FilterBadge label={`Assignee: ${filters.assignee}`} onRemove={() => updateFilter('assignee', undefined)} />
          )}
          {filters.created_after && (
            <FilterBadge label={`After: ${filters.created_after}`} onRemove={() => updateFilter('created_after', undefined)} />
          )}
          {filters.created_before && (
            <FilterBadge label={`Before: ${filters.created_before}`} onRemove={() => updateFilter('created_before', undefined)} />
          )}
          <button onClick={clearAllFilters} className="text-xs text-terminal-muted hover:text-terminal-red ml-1">
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

function FilterBadge({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-terminal-blue/10 text-terminal-blue text-xs border border-terminal-blue/20">
      {label}
      <button onClick={onRemove} className="hover:text-terminal-text ml-0.5">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}
