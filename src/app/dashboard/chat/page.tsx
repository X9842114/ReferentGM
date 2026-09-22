import { TeamChatPanel } from "@/components/team-chat-panel";
import { CapabilityGate } from "@/components/capability-gate";
import { canAccessChat } from "@/lib/permissions";
export default function ChatPage() { return <CapabilityGate allow={canAccessChat} fallbackTitle="Chat réservé" fallbackHint="Le chat interne est réservé aux Référents GM."><TeamChatPanel /></CapabilityGate>; }
