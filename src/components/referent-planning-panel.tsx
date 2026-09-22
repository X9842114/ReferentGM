"use client";

import { EventManager, type Event } from "@/components/ui/event-manager";
import { ReferentsRosterPanel } from "@/components/online-referents";
import { StaffPageShell } from "@/components/staff/staff-page-shell";
import { useAccount } from "@/components/account-context";
import { useDashboardUser } from "@/components/layout/dashboard-user";
import { listAllAccounts, type RefgmAccount } from "@/lib/accounts";
import { isDeveloper, isGameMaster, isListedReferent, isReferent } from "@/lib/permissions";
import {
  deletePlanningSlot,
  isoDate,
  joinPlanningSlot,
  listPlanningSlots,
  savePlanningSlot,
  updatePlanningSlot,
  type PlanningKind,
  type PlanningMate,
  type PlanningPriority,
  type PlanningSlot,
} from "@/lib/referent-planning";
import { useEffect, useMemo, useState } from "react";
import { GripHorizontal } from "lucide-react";

const CATEGORIES = ["Tâche", "Permanence", "Rappel", "Perso"];
const TAGS = ["Urgent", "Important", "À faire", "Autre", "Équipe", "Client"];

function padTime(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function colorForSlot(slot: PlanningSlot) {
  if (slot.kind === "shift") return "green";
  if (slot.priority === "urgent") return "red";
  if (slot.priority === "important") return "orange";
  if (slot.priority === "other") return "purple";
  return "blue";
}

function categoryForSlot(slot: PlanningSlot) {
  return slot.kind === "task" ? "Tâche" : "Permanence";
}

function slotToEvent(slot: PlanningSlot): Event {
  const start = new Date(`${slot.date}T${slot.start || "09:00"}:00`);
  const end = new Date(`${slot.date}T${slot.end || "10:00"}:00`);
  const safeStart = Number.isNaN(start.getTime()) ? new Date() : start;
  const safeEnd =
    Number.isNaN(end.getTime()) || end <= safeStart
      ? new Date(safeStart.getTime() + 3600000)
      : end;
  return {
    id: slot.id,
    title: slot.title,
    description: slot.note,
    startTime: safeStart,
    endTime: safeEnd,
    color: colorForSlot(slot),
    category: categoryForSlot(slot),
    attendees: slot.assignees.map((m) => m.userName),
    assigneeIds: slot.assignees.map((m) => m.userId),
    tags: slot.tags.length
      ? slot.tags
      : [
          slot.priority === "urgent"
            ? "Urgent"
            : slot.priority === "important"
              ? "Important"
              : slot.priority === "other"
                ? "Autre"
                : "À faire",
        ],
  };
}

function kindFromEvent(event: Partial<Event>): PlanningKind {
  return event.category === "Tâche" || event.category === "Rappel" ? "task" : "shift";
}

function priorityFromEvent(event: Partial<Event>): PlanningPriority {
  if (event.tags?.includes("Urgent") || event.color === "red") return "urgent";
  if (event.tags?.includes("Important") || event.color === "orange") return "important";
  if (event.tags?.includes("Autre") || event.color === "purple") return "other";
  return "todo";
}

function matesFromEvent(
  event: Partial<Event>,
  people: { id: string; name: string }[],
  _fallback: PlanningMate
): PlanningMate[] {
  const ids = event.assigneeIds ?? [];
  const mapped = ids
    .map((id) => {
      const person = people.find((p) => p.id === id);
      return person ? { userId: person.id, userName: person.name } : null;
    })
    .filter((m): m is PlanningMate => Boolean(m));
  if (mapped.length) return mapped;
  return (event.attendees ?? [])
    .map((name) => {
      const person = people.find((p) => p.name === name);
      return person ? { userId: person.id, userName: person.name } : null;
    })
    .filter((m): m is PlanningMate => Boolean(m));
}

export function ReferentPlanningPanel() {
  const user = useDashboardUser();
  const { account } = useAccount();
  const [slots, setSlots] = useState(listPlanningSlots());
  const [accounts, setAccounts] = useState<RefgmAccount[]>([]);

  useEffect(() => {
    const refresh = () => setSlots(listPlanningSlots());
    refresh();
    window.addEventListener("refgm:planning-updated", refresh);
    return () => window.removeEventListener("refgm:planning-updated", refresh);
  }, []);

  useEffect(() => {
    void listAllAccounts().then((list) => {
      setAccounts(
        list.filter(
          (a) =>
            a.status === "APPROVED" &&
            (isReferent(a.grade) || isGameMaster(a.grade) || isDeveloper(a.grade))
        )
      );
    });
  }, []);

  const referents = useMemo(
    () =>
      accounts
        .filter((a) => isListedReferent(a.grade))
        .sort((a, b) => a.displayName.localeCompare(b.displayName, "fr")),
    [accounts]
  );

  const people = useMemo(
    () =>
      accounts
        .map((a) => ({
          id: a.userId,
          name: a.displayName,
          avatarUrl: a.discordAvatarUrl,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "fr")),
    [accounts]
  );

  const events = useMemo(() => slots.map(slotToEvent), [slots]);
  const fallback: PlanningMate = {
    userId: user.id,
    userName: user.name || "Référent",
  };

  return (
    <StaffPageShell
      title="Planning"
      description="Permanences et tâches de l’équipe. Tu peux coller des personnes sur un créneau."
      className="max-w-7xl"
    >
      <div className="rg-card flex items-start gap-3 px-4 py-3 sm:items-center">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-200 sm:mt-0">
          <GripHorizontal className="h-4 w-4" />
        </span>
        <p className="text-sm leading-relaxed text-white/70">
          <span className="font-semibold text-white">Assignation :</span>{" "}
          glisse un référent depuis la liste de droite et dépose-le{" "}
          <span className="text-white">sur une tâche</span> du calendrier pour
          lui assigner.
        </p>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_17.5rem]">
        <EventManager
          events={events}
          people={people}
          categories={CATEGORIES}
          availableTags={TAGS}
          defaultView="month"
          onAssignPerson={(eventId, person) => {
            joinPlanningSlot(
              eventId,
              { userId: person.userId, userName: person.userName },
              { id: account.userId, name: account.displayName }
            );
          }}
          onEventCreate={(event) => {
            savePlanningSlot({
              kind: kindFromEvent(event),
              date: isoDate(event.startTime),
              start: padTime(event.startTime),
              end: padTime(event.endTime),
              title: event.title,
              note: event.description ?? "",
              priority: priorityFromEvent(event),
              tags: event.tags ?? [],
              createdBy: user.id,
              assignedByName: user.name || "Référent",
              assignees: matesFromEvent(event, people, fallback),
            });
          }}
          onEventUpdate={(id, event) => {
            const start = event.startTime;
            const end = event.endTime;
            updatePlanningSlot(id, {
              title: event.title,
              note: event.description,
              kind: event.category ? kindFromEvent(event) : undefined,
              priority: event.color || event.tags ? priorityFromEvent(event) : undefined,
              tags: event.tags,
              date: start ? isoDate(start) : undefined,
              start: start ? padTime(start) : undefined,
              end: end ? padTime(end) : undefined,
              assignees:
                event.assigneeIds || event.attendees
                  ? matesFromEvent(event, people, fallback)
                  : undefined,
            });
          }}
          onEventDelete={(id) => deletePlanningSlot(id)}
        />
        <ReferentsRosterPanel accounts={referents} assignable />
      </div>
    </StaffPageShell>
  );
}
