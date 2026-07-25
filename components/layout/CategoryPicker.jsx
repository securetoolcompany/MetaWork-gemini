'use client';
// components/layout/CategoryPicker.jsx
// Two-level accordion: SuperMaster → SubGroup → Options
// Pass groups=IP_CATEGORY_GROUPS for legacy single-domain use,
// or superGroups=SUPER_CATEGORY_GROUPS for the unified two-domain picker.

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import {
  IP_CATEGORY_GROUPS,
  SUPER_CATEGORY_GROUPS,
  parseCategoryString,
  serializeCategoryMap,
  getAllGroups,
} from '@/lib/ipCategories';

/**
 * Props:
 *   value        — comma-separated string, e.g. "Illustration,Cyberpunk,NDA / Confidentiality Agreement"
 *   onChange     — (newValue: string) => void
 *   superGroups  — use SUPER_CATEGORY_GROUPS for two-domain picker (default)
 *   groups       — pass a flat group array to bypass the super-master layer (legacy)
 */
export default function CategoryPicker({
  value = '',
  onChange,
  superGroups = SUPER_CATEGORY_GROUPS,
  groups = null,
}) {
  const flatGroups = groups ?? getAllGroups();
  const selected = parseCategoryString(value, flatGroups);

  // Super-master open state (null = all closed)
  const [openSuper, setOpenSuper] = useState(superGroups[0]?.id ?? null);
  // Sub-group open state per super-group
  const [openSub, setOpenSub] = useState(() =>
    Object.fromEntries(superGroups.map(sg => [sg.id, sg.subGroups[0]?.id ?? null]))
  );

  const toggle = (groupId, option) => {
    const current = selected[groupId] || [];
    const next = current.includes(option)
      ? current.filter(o => o !== option)
      : [...current, option];
    onChange(serializeCategoryMap({ ...selected, [groupId]: next }, flatGroups));
  };

  const removeTag = (option) => {
    const group = flatGroups.find(g => g.options.includes(option));
    if (!group) return;
    onChange(serializeCategoryMap(
      { ...selected, [group.id]: (selected[group.id] || []).filter(o => o !== option) },
      flatGroups
    ));
  };

  const allSelected = flatGroups.flatMap(g => selected[g.id] || []);

  // Legacy mode: no super-master layer
  if (groups) {
    return <LegacyPicker groups={groups} selected={selected} toggle={toggle} removeTag={removeTag} allSelected={allSelected} />;
  }

  return (
    <div className="space-y-1.5">
      {/* Selected tags */}
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

      {/* Super-master accordion */}
      <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
        {superGroups.map(sg => {
          const isSuperOpen = openSuper === sg.id;
          const sgSelectedCount = sg.subGroups.reduce(
            (n, g) => n + (selected[g.id]?.length || 0), 0
          );

          return (
            <div key={sg.id}>
              {/* Super-master header */}
              <button
                type="button"
                className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/50 hover:bg-muted/70 transition-colors text-sm font-semibold"
                onClick={() => setOpenSuper(isSuperOpen ? null : sg.id)}
              >
                <span className="flex items-center gap-2">
                  <span className="text-base">{sg.emoji}</span>
                  <span>{sg.label}</span>
                  {sgSelectedCount > 0 && (
                    <Badge className="text-[10px] h-4 px-1.5 bg-primary text-primary-foreground">
                      {sgSelectedCount}
                    </Badge>
                  )}
                </span>
                {isSuperOpen
                  ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>

              {/* Sub-group accordion inside */}
              {isSuperOpen && (
                <div className="divide-y divide-border/50 bg-background">
                  {sg.subGroups.map(group => {
                    const isSubOpen = openSub[sg.id] === group.id;
                    const groupSelected = selected[group.id] || [];

                    return (
                      <div key={group.id}>
                        <button
                          type="button"
                          className="w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-muted/40 transition-colors"
                          onClick={() =>
                            setOpenSub(prev => ({
                              ...prev,
                              [sg.id]: isSubOpen ? null : group.id,
                            }))
                          }
                        >
                          <span className="flex items-center gap-1.5 font-medium text-foreground">
                            <span>{group.emoji}</span>
                            <span>{group.label}</span>
                            {groupSelected.length > 0 && (
                              <Badge className="text-[10px] h-4 px-1.5 bg-primary text-primary-foreground">
                                {groupSelected.length}
                              </Badge>
                            )}
                          </span>
                          {isSubOpen
                            ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                            : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                        </button>

                        {isSubOpen && (
                          <div className="px-4 pb-3 pt-1 grid grid-cols-2 gap-1.5 bg-muted/10">
                            {group.options.map(opt => {
                              const active = groupSelected.includes(opt);
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => toggle(group.id, opt)}
                                  title={opt}
                                  className={[
                                    'text-xs px-2 py-1.5 rounded-md border text-left truncate transition-colors',
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Legacy single-domain picker (used when groups prop is passed directly) ────
function LegacyPicker({ groups, selected, toggle, removeTag, allSelected }) {
  const [openGroup, setOpenGroup] = useState(groups[0]?.id ?? null);
  return (
    <div className="space-y-1.5">
      {allSelected.length > 0 && (
        <div className="flex flex-wrap gap-1 pb-1">
          {allSelected.map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs gap-1 pr-1 cursor-pointer" onClick={() => removeTag(tag)}>
              {tag}<X className="w-3 h-3" />
            </Badge>
          ))}
        </div>
      )}
      <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
        {groups.map(group => {
          const isOpen = openGroup === group.id;
          const groupSelected = selected[group.id] || [];
          return (
            <div key={group.id}>
              <button type="button"
                className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
                onClick={() => setOpenGroup(isOpen ? null : group.id)}>
                <span className="flex items-center gap-1.5">
                  <span>{group.emoji}</span><span>{group.label}</span>
                  {groupSelected.length > 0 && (
                    <Badge className="text-xs h-4 px-1.5 bg-primary text-primary-foreground">{groupSelected.length}</Badge>
                  )}
                </span>
                {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
              </button>
              {isOpen && (
                <div className="px-3 pb-3 pt-1 grid grid-cols-2 gap-1.5">
                  {group.options.map(opt => {
                    const active = groupSelected.includes(opt);
                    return (
                      <button key={opt} type="button" onClick={() => toggle(group.id, opt)}
                        className={['text-xs px-2 py-1.5 rounded-md border text-left transition-colors',
                          active ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted/60 text-foreground'].join(' ')}>
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