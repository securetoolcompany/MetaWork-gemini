'use client';
// components/CategoryPicker.jsx
// Generic accordion category picker — used for IP assets, Products, and Aisles.
// Pass a `groups` prop to switch taxonomy; defaults to IP_CATEGORY_GROUPS.

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { IP_CATEGORY_GROUPS, parseCategoryString, serializeCategoryMap } from '@/lib/ipCategories';

/**
 * Props:
 *   value    — comma-separated string, e.g. "Illustration,Cyberpunk"
 *   onChange — (newValue: string) => void
 *   groups   — category group array (defaults to IP_CATEGORY_GROUPS)
 */
export default function CategoryPicker({ value = '', onChange, groups = IP_CATEGORY_GROUPS }) {
  const [openGroup, setOpenGroup] = useState(groups[0]?.id ?? null);

  const selected = parseCategoryString(value, groups);

  const toggle = (groupId, option) => {
    const current = selected[groupId] || [];
    const next = current.includes(option)
      ? current.filter(o => o !== option)
      : [...current, option];
    onChange(serializeCategoryMap({ ...selected, [groupId]: next }, groups));
  };

  const removeTag = (option) => {
    const groupId = groups.find(g => g.options.includes(option))?.id;
    if (!groupId) return;
    onChange(serializeCategoryMap(
      { ...selected, [groupId]: (selected[groupId] || []).filter(o => o !== option) },
      groups
    ));
  };

  const allSelected = groups.flatMap(g => selected[g.id] || []);

  return (
    <div className="space-y-1.5">
      {/* Selected tags row */}
      {allSelected.length > 0 && (
        <div className="flex flex-wrap gap-1 pb-1">
          {allSelected.map(tag => (
            <Badge
              key={tag}
              variant="secondary"
              className="text-xs gap-1 pr-1 cursor-pointer"
              onClick={() => removeTag(tag)}
            >
              {tag}
              <X className="w-3 h-3" />
            </Badge>
          ))}
        </div>
      )}

      {/* Accordion groups */}
      <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
        {groups.map(group => {
          const isOpen = openGroup === group.id;
          const groupSelected = selected[group.id] || [];
          return (
            <div key={group.id}>
              <button
                type="button"
                className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
                onClick={() => setOpenGroup(isOpen ? null : group.id)}
              >
                <span className="flex items-center gap-1.5">
                  <span>{group.emoji}</span>
                  <span>{group.label}</span>
                  {groupSelected.length > 0 && (
                    <Badge className="text-xs h-4 px-1.5 bg-primary text-primary-foreground">
                      {groupSelected.length}
                    </Badge>
                  )}
                </span>
                {isOpen
                  ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                  : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
              </button>

              {isOpen && (
                <div className="px-3 pb-3 pt-1 grid grid-cols-2 gap-1.5">
                  {group.options.map(opt => {
                    const active = groupSelected.includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggle(group.id, opt)}
                        className={[
                          'text-xs px-2 py-1.5 rounded-md border text-left transition-colors',
                          active
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border hover:bg-muted/60 text-foreground',
                        ].join(' ')}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}