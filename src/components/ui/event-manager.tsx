"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DiscordAvatar } from "@/components/actor-trace";
import { Button } from "@/components/ui/button";
import { MetallicButton } from "@/components/ui/metallic-button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  endPlanningMateDrag,
  mateFromDrop,
  peekPlanningMate,
  type PlanningMateDrag,
} from "@/lib/planning-drag";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Grid3x3,
  List,
  Search,
} from "lucide-react";

export interface Event {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  color: string;
  category?: string;
  attendees?: string[];
  assigneeIds?: string[];
  tags?: string[];
}

export type CalendarPerson = {
  id: string;
  name: string;
  avatarUrl?: string;
};

export interface EventManagerProps {
  events?: Event[];
  onEventCreate?: (event: Omit<Event, "id">) => void;
  onEventUpdate?: (id: string, event: Partial<Event>) => void;
  onEventDelete?: (id: string) => void;
  categories?: string[];
  colors?: { name: string; value: string; bg: string; text: string }[];
  defaultView?: "month" | "week" | "day" | "list";
  className?: string;
  availableTags?: string[];
  people?: CalendarPerson[];
  onAssignPerson?: (eventId: string, person: PlanningMateDrag) => void;
}

const PeopleCtx = createContext<CalendarPerson[]>([]);

function useCalendarPeople() {
  return useContext(PeopleCtx);
}

const defaultColors = [
  { name: "Bleu", value: "blue", bg: "bg-blue-500", text: "text-blue-700" },
  { name: "Vert", value: "green", bg: "bg-green-500", text: "text-green-700" },
  { name: "Violet", value: "purple", bg: "bg-purple-500", text: "text-purple-700" },
  { name: "Orange", value: "orange", bg: "bg-orange-500", text: "text-orange-700" },
  { name: "Rose", value: "pink", bg: "bg-pink-500", text: "text-pink-700" },
  { name: "Rouge", value: "red", bg: "bg-red-500", text: "text-red-700" },
];

type CalView = "month" | "week" | "day" | "list";

function mondayOf(date: Date) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function toLocalInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

export function EventManager({
  events: initialEvents = [],
  onEventCreate,
  onEventUpdate,
  onEventDelete,
  categories = ["Permanence", "Tâche", "Rappel", "Perso"],
  colors = defaultColors,
  defaultView = "month",
  className,
  availableTags = ["Urgent", "Important", "À faire", "Autre", "Équipe", "Client"],
  people = [],
  onAssignPerson,
}: EventManagerProps) {
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalView>(defaultView);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [draggedEvent, setDraggedEvent] = useState<Event | null>(null);
  const [newEvent, setNewEvent] = useState<Partial<Event>>({
    title: "",
    description: "",
    color: colors[0].value,
    category: categories[0],
    tags: [],
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          event.title.toLowerCase().includes(query) ||
          event.description?.toLowerCase().includes(query) ||
          event.category?.toLowerCase().includes(query) ||
          event.tags?.some((tag) => tag.toLowerCase().includes(query)) ||
          event.attendees?.some((name) => name.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }
      if (selectedColors.length > 0 && !selectedColors.includes(event.color)) {
        return false;
      }
      if (selectedTags.length > 0) {
        const hasMatchingTag = event.tags?.some((tag) => selectedTags.includes(tag));
        if (!hasMatchingTag) return false;
      }
      if (
        selectedCategories.length > 0 &&
        event.category &&
        !selectedCategories.includes(event.category)
      ) {
        return false;
      }
      return true;
    });
  }, [events, searchQuery, selectedColors, selectedTags, selectedCategories]);

  const hasActiveFilters =
    selectedColors.length > 0 || selectedTags.length > 0 || selectedCategories.length > 0;

  const handleCreateEvent = useCallback(() => {
    if (!newEvent.title || !newEvent.startTime || !newEvent.endTime) return;
    const event: Event = {
      id: Math.random().toString(36).slice(2, 11),
      title: newEvent.title,
      description: newEvent.description,
      startTime: newEvent.startTime,
      endTime: newEvent.endTime,
      color: newEvent.color || colors[0].value,
      category: newEvent.category,
      attendees: newEvent.attendees || [],
      assigneeIds: newEvent.assigneeIds || [],
      tags: newEvent.tags || [],
    };
    setEvents((prev) => [...prev, event]);
    onEventCreate?.(event);
    setIsDialogOpen(false);
    setIsCreating(false);
    setNewEvent({
      title: "",
      description: "",
      color: colors[0].value,
      category: categories[0],
      tags: [],
    });
  }, [newEvent, colors, categories, onEventCreate]);

  const handleUpdateEvent = useCallback(() => {
    if (!selectedEvent) return;
    setEvents((prev) => prev.map((e) => (e.id === selectedEvent.id ? selectedEvent : e)));
    onEventUpdate?.(selectedEvent.id, selectedEvent);
    setIsDialogOpen(false);
    setSelectedEvent(null);
  }, [selectedEvent, onEventUpdate]);

  const handleDeleteEvent = useCallback(
    (id: string) => {
      setEvents((prev) => prev.filter((e) => e.id !== id));
      onEventDelete?.(id);
      setIsDialogOpen(false);
      setSelectedEvent(null);
    },
    [onEventDelete]
  );

  const handleAssignPerson = useCallback(
    (event: Event, person: PlanningMateDrag) => {
      onAssignPerson?.(event.id, person);
      setEvents((prev) =>
        prev.map((row) => {
          if (row.id !== event.id) return row;
          const ids = row.assigneeIds ?? [];
          if (ids.includes(person.userId)) return row;
          return {
            ...row,
            assigneeIds: [...ids, person.userId],
            attendees: [...(row.attendees ?? []), person.userName],
          };
        })
      );
    },
    [onAssignPerson]
  );

  const handleDrop = useCallback(
    (date: Date, hour?: number) => {
      if (peekPlanningMate()) return;
      if (!draggedEvent) return;
      const duration = draggedEvent.endTime.getTime() - draggedEvent.startTime.getTime();
      const newStartTime = new Date(date);
      if (hour !== undefined) newStartTime.setHours(hour, 0, 0, 0);
      const newEndTime = new Date(newStartTime.getTime() + duration);
      const updatedEvent = { ...draggedEvent, startTime: newStartTime, endTime: newEndTime };
      setEvents((prev) => prev.map((e) => (e.id === draggedEvent.id ? updatedEvent : e)));
      onEventUpdate?.(draggedEvent.id, updatedEvent);
      setDraggedEvent(null);
    },
    [draggedEvent, onEventUpdate]
  );

  const navigateDate = useCallback(
    (direction: "prev" | "next") => {
      setCurrentDate((prev) => {
        const next = new Date(prev);
        if (view === "month") next.setMonth(prev.getMonth() + (direction === "next" ? 1 : -1));
        else if (view === "week") next.setDate(prev.getDate() + (direction === "next" ? 7 : -7));
        else if (view === "day") next.setDate(prev.getDate() + (direction === "next" ? 1 : -1));
        return next;
      });
    },
    [view]
  );

  const getColorClasses = useCallback(
    (colorValue: string) => colors.find((c) => c.value === colorValue) || colors[0],
    [colors]
  );

  const toggleTag = (tag: string, creating: boolean) => {
    if (creating) {
      setNewEvent((prev) => ({
        ...prev,
        tags: prev.tags?.includes(tag)
          ? prev.tags.filter((t) => t !== tag)
          : [...(prev.tags || []), tag],
      }));
    } else {
      setSelectedEvent((prev) =>
        prev
          ? {
              ...prev,
              tags: prev.tags?.includes(tag)
                ? prev.tags.filter((t) => t !== tag)
                : [...(prev.tags || []), tag],
            }
          : null
      );
    }
  };

  const togglePerson = (person: CalendarPerson, creating: boolean) => {
    const apply = <T extends Partial<Event>>(prev: T): T => {
      const ids = prev.assigneeIds ?? [];
      const names = prev.attendees ?? [];
      const has = ids.includes(person.id);
      return {
        ...prev,
        assigneeIds: has ? ids.filter((id) => id !== person.id) : [...ids, person.id],
        attendees: has
          ? names.filter((n) => n !== person.name)
          : [...names, person.name],
      };
    };
    if (creating) setNewEvent((prev) => apply(prev));
    else setSelectedEvent((prev) => (prev ? apply(prev) : null));
  };

  const title =
    view === "month"
      ? currentDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
      : view === "week"
        ? `Semaine du ${currentDate.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`
        : view === "day"
          ? currentDate.toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })
          : "Tous les créneaux";

  const openCreate = () => {
    const start = new Date(currentDate);
    start.setHours(9, 0, 0, 0);
    const end = new Date(start);
    end.setHours(10, 0, 0, 0);
    setNewEvent({
      title: "",
      description: "",
      color: colors[0].value,
      category: categories[0],
      tags: [],
      attendees: [],
      assigneeIds: [],
      startTime: start,
      endTime: end,
    });
    setIsCreating(true);
    setIsDialogOpen(true);
  };

  return (
    <PeopleCtx.Provider value={people}>
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <h2 className="text-xl font-semibold capitalize sm:text-2xl">{title}</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigateDate("prev")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
              Aujourd’hui
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigateDate("next")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="sm:hidden">
            <label className="sr-only" htmlFor="cal-view">
              Vue
            </label>
            <select
              id="cal-view"
              value={view}
              onChange={(e) => setView(e.target.value as CalView)}
              className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
            >
              <option value="month">Mois</option>
              <option value="week">Semaine</option>
              <option value="day">Jour</option>
              <option value="list">Liste</option>
            </select>
          </div>
          <div className="hidden items-center gap-1 rounded-lg border bg-background p-1 sm:flex">
            {(
              [
                ["month", "Mois", Calendar],
                ["week", "Semaine", Grid3x3],
                ["day", "Jour", Clock],
                ["list", "Liste", List],
              ] as const
            ).map(([id, label, Icon]) => (
              <Button
                key={id}
                variant={view === id ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView(id)}
              >
                <Icon className="h-4 w-4" />
                <span className="ml-1">{label}</span>
              </Button>
            ))}
          </div>
          <MetallicButton
            type="button"
            onClick={openCreate}
            label="Nouveau"
            className="w-full sm:w-auto"
          />
        </div>
      </div>

      <div className="relative">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Chercher un créneau…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-12"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterMenu label="Couleurs" count={selectedColors.length}>
          {colors.map((color) => (
            <MenuRow
              key={color.value}
              active={selectedColors.includes(color.value)}
              onClick={() =>
                setSelectedColors((prev) =>
                  prev.includes(color.value)
                    ? prev.filter((c) => c !== color.value)
                    : [...prev, color.value]
                )
              }
            >
              <span className={cn("h-3 w-3 rounded", color.bg)} />
              {color.name}
            </MenuRow>
          ))}
        </FilterMenu>
        <FilterMenu label="Tags" count={selectedTags.length}>
          {availableTags.map((tag) => (
            <MenuRow
              key={tag}
              active={selectedTags.includes(tag)}
              onClick={() =>
                setSelectedTags((prev) =>
                  prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                )
              }
            >
              {tag}
            </MenuRow>
          ))}
        </FilterMenu>
        <FilterMenu label="Types" count={selectedCategories.length}>
          {categories.map((category) => (
            <MenuRow
              key={category}
              active={selectedCategories.includes(category)}
              onClick={() =>
                setSelectedCategories((prev) =>
                  prev.includes(category)
                    ? prev.filter((c) => c !== category)
                    : [...prev, category]
                )
              }
            >
              {category}
            </MenuRow>
          ))}
        </FilterMenu>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={() => {
              setSelectedColors([]);
              setSelectedTags([]);
              setSelectedCategories([]);
              setSearchQuery("");
            }}
            className="rounded-full px-3 py-1.5 text-sm text-white/50 hover:text-white"
          >
            Tout afficher
          </button>
        ) : null}
      </div>

      {view === "month" && (
        <MonthView
          currentDate={currentDate}
          events={filteredEvents}
          onEventClick={(event) => {
            setSelectedEvent(event);
            setIsCreating(false);
            setIsDialogOpen(true);
          }}
          onDragStart={setDraggedEvent}
          onDragEnd={() => setDraggedEvent(null)}
          onDrop={handleDrop}
          onAssignPerson={handleAssignPerson}
          getColorClasses={getColorClasses}
        />
      )}
      {view === "week" && (
        <WeekView
          currentDate={currentDate}
          events={filteredEvents}
          onEventClick={(event) => {
            setSelectedEvent(event);
            setIsCreating(false);
            setIsDialogOpen(true);
          }}
          onDragStart={setDraggedEvent}
          onDragEnd={() => setDraggedEvent(null)}
          onDrop={handleDrop}
          onAssignPerson={handleAssignPerson}
          getColorClasses={getColorClasses}
        />
      )}
      {view === "day" && (
        <DayView
          currentDate={currentDate}
          events={filteredEvents}
          onEventClick={(event) => {
            setSelectedEvent(event);
            setIsCreating(false);
            setIsDialogOpen(true);
          }}
          onDragStart={setDraggedEvent}
          onDragEnd={() => setDraggedEvent(null)}
          onDrop={handleDrop}
          onAssignPerson={handleAssignPerson}
          getColorClasses={getColorClasses}
        />
      )}
      {view === "list" && (
        <ListView
          events={filteredEvents}
          onEventClick={(event) => {
            setSelectedEvent(event);
            setIsCreating(false);
            setIsDialogOpen(true);
          }}
          onAssignPerson={handleAssignPerson}
          getColorClasses={getColorClasses}
        />
      )}

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setIsCreating(false);
            setSelectedEvent(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-visible sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isCreating ? "Nouveau créneau" : "Détail"}</DialogTitle>
            <DialogDescription>
              {isCreating ? "Ajoute une permanence ou une tâche." : "Modifie ou retire ce créneau."}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[min(62vh,32rem)] space-y-4 overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label htmlFor="title">Titre</Label>
              <Input
                id="title"
                value={isCreating ? newEvent.title : selectedEvent?.title}
                onChange={(e) =>
                  isCreating
                    ? setNewEvent((prev) => ({ ...prev, title: e.target.value }))
                    : setSelectedEvent((prev) => (prev ? { ...prev, title: e.target.value } : null))
                }
                placeholder="Titre"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Note</Label>
              <Textarea
                id="description"
                value={isCreating ? newEvent.description : selectedEvent?.description}
                onChange={(e) =>
                  isCreating
                    ? setNewEvent((prev) => ({ ...prev, description: e.target.value }))
                    : setSelectedEvent((prev) =>
                        prev ? { ...prev, description: e.target.value } : null
                      )
                }
                placeholder="Détail"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Début</Label>
                <Input
                  id="startTime"
                  type="datetime-local"
                  value={
                    isCreating
                      ? newEvent.startTime
                        ? toLocalInput(newEvent.startTime)
                        : ""
                      : selectedEvent
                        ? toLocalInput(selectedEvent.startTime)
                        : ""
                  }
                  onChange={(e) => {
                    const date = new Date(e.target.value);
                    isCreating
                      ? setNewEvent((prev) => ({ ...prev, startTime: date }))
                      : setSelectedEvent((prev) => (prev ? { ...prev, startTime: date } : null));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">Fin</Label>
                <Input
                  id="endTime"
                  type="datetime-local"
                  value={
                    isCreating
                      ? newEvent.endTime
                        ? toLocalInput(newEvent.endTime)
                        : ""
                      : selectedEvent
                        ? toLocalInput(selectedEvent.endTime)
                        : ""
                  }
                  onChange={(e) => {
                    const date = new Date(e.target.value);
                    isCreating
                      ? setNewEvent((prev) => ({ ...prev, endTime: date }))
                      : setSelectedEvent((prev) => (prev ? { ...prev, endTime: date } : null));
                  }}
                />
              </div>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((cat) => {
                    const active =
                      (isCreating ? newEvent.category : selectedEvent?.category) === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() =>
                          isCreating
                            ? setNewEvent((prev) => ({ ...prev, category: cat }))
                            : setSelectedEvent((prev) =>
                                prev ? { ...prev, category: cat } : null
                              )
                        }
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[12px]",
                          active
                            ? "border-violet-400/40 bg-violet-500/20 text-violet-100"
                            : "border-white/10 text-white/50 hover:text-white/80"
                        )}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-1.5">
                  {availableTags.map((tag) => {
                    const active = isCreating
                      ? newEvent.tags?.includes(tag)
                      : selectedEvent?.tags?.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag, isCreating)}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[12px]",
                          active
                            ? "border-violet-400/40 bg-violet-500/20 text-violet-100"
                            : "border-white/10 text-white/50 hover:text-white/80"
                        )}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
              {people.length > 0 ? (
                <div className="space-y-1.5">
                  <Label>Référents</Label>
                  <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto pr-1">
                    {people.map((person) => {
                      const ids = isCreating
                        ? newEvent.assigneeIds ?? []
                        : selectedEvent?.assigneeIds ?? [];
                      const active = ids.includes(person.id);
                      return (
                        <button
                          key={person.id}
                          type="button"
                          onClick={() => togglePerson(person, isCreating)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5 text-[12px]",
                            active
                              ? "border-violet-400/40 bg-violet-500/20 text-violet-100"
                              : "border-white/10 text-white/55 hover:text-white/80"
                          )}
                        >
                          <DiscordAvatar
                            name={person.name}
                            url={person.avatarUrl}
                            userId={person.id}
                            size={22}
                          />
                          {person.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-[12px] text-white/35">
                  Les référents apparaissent ici une fois les comptes chargés.
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            {!isCreating ? (
              <button
                type="button"
                className="rg-btn rg-btn-danger mr-auto"
                onClick={() => selectedEvent && handleDeleteEvent(selectedEvent.id)}
              >
                Supprimer
              </button>
            ) : null}
            <button
              type="button"
              className="rg-btn"
              onClick={() => {
                setIsDialogOpen(false);
                setIsCreating(false);
                setSelectedEvent(null);
              }}
            >
              Annuler
            </button>
            <MetallicButton
              type="button"
              onClick={isCreating ? handleCreateEvent : handleUpdateEvent}
              label={isCreating ? "Créer" : "Enregistrer"}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PeopleCtx.Provider>
  );
}

function FilterMenu({
  label,
  count,
  children,
}: {
  label: string;
  count?: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const box = buttonRef.current?.getBoundingClientRect();
      if (!box) return;
      setPos({ top: box.bottom + 6, left: box.left });
    };
    place();
    const onDoc = (event: MouseEvent) => {
      const node = event.target as Node;
      if (rootRef.current?.contains(node) || menuRef.current?.contains(node)) {
        return;
      }
      setOpen(false);
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("mousedown", onDoc);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 text-sm text-white/85 hover:bg-white/[0.08]",
          open && "bg-white/15"
        )}
      >
        <Filter className="h-3.5 w-3.5 opacity-70" />
        {label}
        {count ? (
          <span className="rounded-full bg-white/15 px-1.5 text-[11px] tabular-nums">
            {count}
          </span>
        ) : null}
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              data-filter-menu=""
              className="fixed z-[200] max-h-64 min-w-48 overflow-y-auto rounded-xl border border-white/10 bg-[#161618] p-1 shadow-2xl"
              style={{ top: pos.top, left: pos.left }}
            >
              {children}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function MenuRow({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm",
        active
          ? "bg-white text-[#0a0a0b]"
          : "text-white/80 hover:bg-white/[0.08]"
      )}
    >
      {children}
    </button>
  );
}

function EventCard({
  event,
  onEventClick,
  onDragStart,
  onDragEnd,
  onAssignPerson,
  getColorClasses,
  variant = "default",
}: {
  event: Event;
  onEventClick: (event: Event) => void;
  onDragStart: (event: Event) => void;
  onDragEnd: () => void;
  onAssignPerson?: (event: Event, person: PlanningMateDrag) => void;
  getColorClasses: (color: string) => { bg: string; text: string };
  variant?: "default" | "compact" | "detailed";
}) {
  const people = useCalendarPeople();
  const colorClasses = getColorClasses(event.color);
  const time = event.startTime.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const faces = (event.assigneeIds ?? [])
    .map((id) => people.find((p) => p.id === id))
    .filter((p): p is CalendarPerson => Boolean(p));
  const names =
    faces.length > 0
      ? faces.map((p) => p.name)
      : event.attendees ?? [];
  return (
    <div
      draggable
      onDragStart={() => {
        if (peekPlanningMate()) return;
        onDragStart(event);
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        if (!peekPlanningMate()) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(e) => {
        const mate = mateFromDrop(e) || peekPlanningMate();
        if (!mate) return;
        e.preventDefault();
        e.stopPropagation();
        onAssignPerson?.(event, mate);
        endPlanningMateDrag();
      }}
      onClick={() => onEventClick(event)}
      className={cn(
        "cursor-pointer rounded px-1.5 py-0.5 text-xs font-medium text-white",
        colorClasses.bg,
        variant === "detailed" && "rounded-lg p-3"
      )}
    >
      <div className="truncate">{event.title}</div>
      {variant !== "compact" ? (
        <div className="mt-0.5 text-[10px] opacity-80">{time}</div>
      ) : null}
      {event.tags && event.tags.length > 0 ? (
        <div className="mt-0.5 truncate text-[10px] opacity-80">
          {event.tags.join(" · ")}
        </div>
      ) : null}
      {faces.length > 0 ? (
        <div className="mt-1 flex items-center">
          {faces.slice(0, 4).map((person, index) => (
            <span
              key={person.id}
              className="inline-flex"
              style={{ marginLeft: index === 0 ? 0 : -6 }}
            >
              <DiscordAvatar
                name={person.name}
                url={person.avatarUrl}
                userId={person.id}
                size={18}
              />
            </span>
          ))}
        </div>
      ) : names.length > 0 ? (
        <div className="mt-0.5 truncate text-[10px] opacity-80">
          {names.join(", ")}
        </div>
      ) : null}
    </div>
  );
}

function sameDay(a: Date, b: Date) {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

function MonthView({
  currentDate,
  events,
  onEventClick,
  onDragStart,
  onDragEnd,
  onDrop,
  onAssignPerson,
  getColorClasses,
}: {
  currentDate: Date;
  events: Event[];
  onEventClick: (event: Event) => void;
  onDragStart: (event: Event) => void;
  onDragEnd: () => void;
  onDrop: (date: Date) => void;
  onAssignPerson?: (event: Event, person: PlanningMateDrag) => void;
  getColorClasses: (color: string) => { bg: string; text: string };
}) {
  const startDate = mondayOf(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    return d;
  });

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 border-b">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => (
          <div key={day} className="border-r p-2 text-center text-xs font-medium last:border-r-0">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayEvents = events.filter((event) => sameDay(event.startTime, day));
          const isCurrentMonth = day.getMonth() === currentDate.getMonth();
          const isToday = sameDay(day, new Date());
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "min-h-20 border-b border-r p-1 last:border-r-0 sm:min-h-24 sm:p-2",
                !isCurrentMonth && "bg-muted/30"
              )}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(day)}
            >
              <div
                className={cn(
                  "mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs",
                  isToday && "bg-primary font-semibold text-primary-foreground"
                )}
              >
                {day.getDate()}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onEventClick={onEventClick}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    onAssignPerson={onAssignPerson}
                    getColorClasses={getColorClasses}
                    variant="compact"
                  />
                ))}
                {dayEvents.length > 3 ? (
                  <div className="text-[10px] text-muted-foreground">+{dayEvents.length - 3}</div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function WeekView({
  currentDate,
  events,
  onEventClick,
  onDragStart,
  onDragEnd,
  onDrop,
  onAssignPerson,
  getColorClasses,
}: {
  currentDate: Date;
  events: Event[];
  onEventClick: (event: Event) => void;
  onDragStart: (event: Event) => void;
  onDragEnd: () => void;
  onDrop: (date: Date, hour: number) => void;
  onAssignPerson?: (event: Event, person: PlanningMateDrag) => void;
  getColorClasses: (color: string) => { bg: string; text: string };
}) {
  const startOfWeek = mondayOf(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + i);
    return day;
  });
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <Card className="overflow-auto">
      <div className="grid grid-cols-8 border-b">
        <div className="border-r p-2 text-center text-xs">Heure</div>
        {weekDays.map((day) => (
          <div key={day.toISOString()} className="border-r p-2 text-center text-xs last:border-r-0">
            {day.toLocaleDateString("fr-FR", { weekday: "short" })}
            <div className="text-muted-foreground">
              {day.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
            </div>
          </div>
        ))}
      </div>
      {hours.map((hour) => (
        <div key={hour} className="grid grid-cols-8">
          <div className="border-b border-r p-1 text-[10px] text-muted-foreground">
            {String(hour).padStart(2, "0")}:00
          </div>
          {weekDays.map((day) => {
            const dayEvents = events.filter((event) => {
              return sameDay(event.startTime, day) && event.startTime.getHours() === hour;
            });
            return (
              <div
                key={`${day.toISOString()}-${hour}`}
                className="min-h-12 border-b border-r p-0.5 last:border-r-0"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(day, hour)}
              >
                {dayEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onEventClick={onEventClick}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    onAssignPerson={onAssignPerson}
                    getColorClasses={getColorClasses}
                  />
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </Card>
  );
}

function DayView({
  currentDate,
  events,
  onEventClick,
  onDragStart,
  onDragEnd,
  onDrop,
  onAssignPerson,
  getColorClasses,
}: {
  currentDate: Date;
  events: Event[];
  onEventClick: (event: Event) => void;
  onDragStart: (event: Event) => void;
  onDragEnd: () => void;
  onDrop: (date: Date, hour: number) => void;
  onAssignPerson?: (event: Event, person: PlanningMateDrag) => void;
  getColorClasses: (color: string) => { bg: string; text: string };
}) {
  return (
    <Card className="overflow-auto">
      {Array.from({ length: 24 }, (_, hour) => {
        const hourEvents = events.filter(
          (event) => sameDay(event.startTime, currentDate) && event.startTime.getHours() === hour
        );
        return (
          <div
            key={hour}
            className="flex border-b last:border-b-0"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(currentDate, hour)}
          >
            <div className="w-16 shrink-0 border-r p-2 text-xs text-muted-foreground">
              {String(hour).padStart(2, "0")}:00
            </div>
            <div className="min-h-16 flex-1 space-y-2 p-1">
              {hourEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onEventClick={onEventClick}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onAssignPerson={onAssignPerson}
                  getColorClasses={getColorClasses}
                  variant="detailed"
                />
              ))}
            </div>
          </div>
        );
      })}
    </Card>
  );
}

function ListView({
  events,
  onEventClick,
  onAssignPerson,
  getColorClasses,
}: {
  events: Event[];
  onEventClick: (event: Event) => void;
  onAssignPerson?: (event: Event, person: PlanningMateDrag) => void;
  getColorClasses: (color: string) => { bg: string; text: string };
}) {
  const sorted = [...events].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  const grouped = sorted.reduce(
    (acc, event) => {
      const key = event.startTime.toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      acc[key] ??= [];
      acc[key].push(event);
      return acc;
    },
    {} as Record<string, Event[]>
  );

  return (
    <Card className="p-4">
      {Object.entries(grouped).map(([date, dateEvents]) => (
        <div key={date} className="mb-6 space-y-2">
          <h3 className="text-sm font-semibold capitalize text-muted-foreground">{date}</h3>
          {dateEvents.map((event) => {
            const color = getColorClasses(event.color);
            return (
              <button
                key={event.id}
                type="button"
                onClick={() => onEventClick(event)}
                onDragOver={(e) => {
                  if (!peekPlanningMate()) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                }}
                onDrop={(e) => {
                  const mate = mateFromDrop(e) || peekPlanningMate();
                  if (!mate) return;
                  e.preventDefault();
                  onAssignPerson?.(event, mate);
                  endPlanningMateDrag();
                }}
                className="flex w-full items-start gap-3 rounded-lg border p-3 text-left hover:bg-muted/40"
              >
                <span className={cn("mt-1 h-3 w-3 rounded-full", color.bg)} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{event.title}</span>
                  {event.description ? (
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {event.description}
                    </span>
                  ) : null}
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {event.startTime.toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    à{" "}
                    {event.endTime.toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ))}
      {sorted.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Aucun créneau.</p>
      ) : null}
    </Card>
  );
}
